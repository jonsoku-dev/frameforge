#!/usr/bin/env python3
"""Stage a project-local snapshot without following symlinks; the WAV is read in full.

The SHA identifies the bytes copied, not their provenance or equivalence to the
current composition. Media format and duration must be checked by the caller.
"""

import hashlib
import json
import math
import os
import re
import secrets
import signal
import stat
import sys

MAX_MANIFEST = 1024 * 1024
MAX_SNAPSHOT = 512 * 1024 * 1024
FIELDS = {'version', 'composition', 'fps', 'durationInFrames', 'sha256'}


def relative_parts(value, kind):
    if not isinstance(value, str) or not value or '\x00' in value or '\\' in value or os.path.isabs(value) or re.match(r'^[A-Za-z][A-Za-z0-9+.-]*:', value):
        raise ValueError(f'{kind} must be a project-relative path.')
    parts = value.split('/')
    if any(part == '..' for part in parts):
        raise ValueError(f'{kind} path must not contain .. components.')
    parts = [part for part in parts if part not in ('', '.')]
    if not parts:
        raise ValueError(f'{kind} must name a project-local file.')
    if kind == 'snapshot' and not parts[-1].lower().endswith('.wav'):
        raise ValueError('snapshot must have a .wav extension.')
    return parts


def metadata(value):
    if not isinstance(value, dict) or set(value) != FIELDS or type(value['version']) is not int or value['version'] != 1:
        raise ValueError('manifest must contain exactly version, composition, fps, durationInFrames and sha256.')
    comp, fps, frames, digest = value['composition'], value['fps'], value['durationInFrames'], value['sha256']
    if not isinstance(comp, str) or not comp.strip() or len(comp) > 256 or any(ord(c) < 32 for c in comp):
        raise ValueError('manifest composition must be a nonempty identifier.')
    try:
        valid_fps = type(fps) in (int, float) and math.isfinite(fps) and fps > 0
    except OverflowError:
        valid_fps = False
    if not valid_fps:
        raise ValueError('manifest fps must be a finite positive number.')
    if type(frames) is not int or not 0 < frames <= 9007199254740991:
        raise ValueError('manifest durationInFrames must be a positive safe integer.')
    if not isinstance(digest, str) or not re.fullmatch(r'[0-9a-f]{64}', digest):
        raise ValueError('manifest sha256 must contain 64 lowercase hexadecimal characters.')
    return value


def no_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f'duplicate manifest key: {key}')
        result[key] = value
    return result


def parse_manifest(raw):
    if len(raw) > MAX_MANIFEST:
        raise ValueError('manifest exceeds 1 MiB.')
    return metadata(json.loads(raw.decode('utf-8'), object_pairs_hook=no_duplicates,
                               parse_constant=lambda value: (_ for _ in ()).throw(ValueError(f'invalid JSON number: {value}'))))


def stamp(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


def open_at(root_fd, parts, opened):
    directory = root_fd
    for part in parts[:-1]:
        directory = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
        opened.append(directory)
    fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
    opened.append(fd)
    info = os.fstat(fd)
    if not stat.S_ISREG(info.st_mode):
        raise ValueError('snapshot and manifest must be regular files.')
    return fd, info


def read_manifest(fd):
    with os.fdopen(os.dup(fd), 'rb') as source:
        return parse_manifest(source.read(MAX_MANIFEST + 1))


def digest_copy(fd, output=None):
    digest = hashlib.sha256()
    total = 0
    with os.fdopen(os.dup(fd), 'rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            total += len(chunk)
            if total > MAX_SNAPSHOT:
                raise ValueError('snapshot exceeds 512 MiB.')
            digest.update(chunk)
            if output is not None:
                output.write(chunk)
    return digest.hexdigest()


def verify(root, root_info, parts_and_info, opened):
    # Reopen the root and each path so path replacement during the read fails.
    root_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    opened.append(root_fd)
    current_root = os.fstat(root_fd)
    if (current_root.st_dev, current_root.st_ino) != (root_info.st_dev, root_info.st_ino):
        raise ValueError('project root changed during snapshot read.')
    for parts, original in parts_and_info:
        _, current = open_at(root_fd, parts, opened)
        if stamp(current) != stamp(original):
            raise ValueError('project file changed during snapshot read.')


def write_manifest(root, root_fd, root_info, parts, data, source_list, opened):
    directory = root_fd
    for part in parts[:-1]:
        directory = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
        opened.append(directory)
    # The final name is linked only after the complete manifest and its source
    # have been checked. The private temporary file shares the same directory.
    temporary = f'.frameforge-manifest-{secrets.token_hex(16)}.tmp'
    # Defer SIGTERM until the descriptor is registered and its finally is active.
    old_mask = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGTERM})
    try:
        fd = os.open(temporary, os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=directory)
        opened.append(fd)
        try:
            signal.pthread_sigmask(signal.SIG_SETMASK, old_mask)
            encoded = (json.dumps(data, allow_nan=False) + '\n').encode('utf-8')
            remaining = memoryview(encoded)
            while remaining:
                written = os.write(fd, remaining)
                if written <= 0:
                    raise OSError('could not write manifest')
                remaining = remaining[written:]
            info = os.fstat(fd)
            verify(root, root_info, [*source_list, (parts[:-1] + [temporary], info)], opened)
            os.link(temporary, parts[-1], src_dir_fd=directory, dst_dir_fd=directory, follow_symlinks=False)
            published = os.stat(parts[-1], dir_fd=directory, follow_symlinks=False)
            opened_info = os.fstat(fd)
            if not stat.S_ISREG(published.st_mode) or (published.st_dev, published.st_ino) != (opened_info.st_dev, opened_info.st_ino):
                raise ValueError('manifest final identity changed; unowned final path retained.')
            if os.pread(fd, MAX_MANIFEST + 1, 0) != encoded:
                current = os.stat(parts[-1], dir_fd=directory, follow_symlinks=False)
                if (current.st_dev, current.st_ino) == (opened_info.st_dev, opened_info.st_ino):
                    os.unlink(parts[-1], dir_fd=directory)
                raise ValueError('manifest changed while being published.')
        finally:
            signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGTERM})
            try:
                current = os.stat(temporary, dir_fd=directory, follow_symlinks=False)
                created = os.fstat(fd)
                if (current.st_dev, current.st_ino) == (created.st_dev, created.st_ino):
                    os.unlink(temporary, dir_fd=directory)
            except FileNotFoundError:
                pass
    finally:
        signal.pthread_sigmask(signal.SIG_SETMASK, old_mask)


def interrupted(_signum, _frame):
    raise InterruptedError('Audio snapshot preparation interrupted by SIGTERM.')


def inspect(root, snapshot, manifest=None, scratch=None, supplied=None, manifest_output=None, scratch_descriptor=None):
    if os.name != 'posix' or not hasattr(os, 'O_NOFOLLOW') or not hasattr(os, 'O_DIRECTORY') or os.open not in os.supports_dir_fd:
        raise ValueError('Audio snapshots require POSIX openat and no-follow support.')
    wav_parts = relative_parts(snapshot, 'snapshot')
    manifest_parts = relative_parts(manifest, 'manifest') if manifest is not None else None
    output_parts = relative_parts(manifest_output, 'manifest output') if manifest_output is not None else None
    if output_parts and not output_parts[-1].lower().endswith('.json'):
        raise ValueError('manifest output must have a .json extension.')
    if supplied is not None:
        metadata({**supplied, 'sha256': '0' * 64})
    root = os.path.realpath(root)
    opened, created, scratch_fd, destination_info = [], False, None, None
    try:
        root_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        opened.append(root_fd)
        root_info = os.fstat(root_fd)
        source_fd, source_info = open_at(root_fd, wav_parts, opened)
        if source_info.st_size > MAX_SNAPSHOT:
            raise ValueError('snapshot exceeds 512 MiB.')
        source_list = [(wav_parts, source_info)]
        if manifest_parts:
            manifest_fd, manifest_info = open_at(root_fd, manifest_parts, opened)
            data = read_manifest(manifest_fd)
            if stamp(os.fstat(manifest_fd)) != stamp(manifest_info):
                raise ValueError('manifest changed during snapshot read.')
            source_list.append((manifest_parts, manifest_info))
        else:
            data = supplied
        if scratch is None:
            digest = digest_copy(source_fd)
        else:
            scratch_fd = os.dup(scratch_descriptor) if scratch_descriptor is not None else os.open(scratch, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            opened.append(scratch_fd)
            scratch_info = os.fstat(scratch_fd)
            if scratch_info.st_uid != os.getuid() or scratch_info.st_mode & 0o077:
                raise ValueError('scratch must be a private directory owned by the current user.')
            destination = os.open('snapshot.wav', os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=scratch_fd)
            created = True
            destination_info = os.fstat(destination)
            with os.fdopen(destination, 'wb') as output:
                digest = digest_copy(source_fd, output)
            now = os.stat(scratch, follow_symlinks=False)
            if (now.st_dev, now.st_ino) != (scratch_info.st_dev, scratch_info.st_ino):
                raise ValueError('scratch directory changed during snapshot read.')
        if stamp(os.fstat(source_fd)) != stamp(source_info):
            raise ValueError('snapshot changed during read.')
        verify(root, root_info, source_list, opened)
        if supplied is not None:
            data = metadata({**supplied, 'sha256': digest})
            if output_parts:
                write_manifest(root, root_fd, root_info, output_parts, data, source_list, opened)
            return data
        if digest != data['sha256']:
            raise ValueError('snapshot SHA-256 does not match manifest.')
        return {'snapshot': os.path.join(os.path.abspath(scratch), 'snapshot.wav'), 'snapshotDev': str(destination_info.st_dev), 'snapshotIno': str(destination_info.st_ino), **{key: data[key] for key in ('sha256', 'composition', 'fps', 'durationInFrames')}}
    except (OSError, ValueError, UnicodeError):
        if created:
            try:
                current = os.stat('snapshot.wav', dir_fd=scratch_fd, follow_symlinks=False)
                if (current.st_dev, current.st_ino) == (destination_info.st_dev, destination_info.st_ino):
                    os.unlink('snapshot.wav', dir_fd=scratch_fd)
            except OSError:
                pass
        raise
    finally:
        for fd in reversed(opened):
            os.close(fd)


def cleanup(scratch, expected_dev, expected_ino):
    directory = 3  # Opened by the renderer, before staging starts.
    identity = os.fstat(directory)
    if not stat.S_ISDIR(identity.st_mode):
        raise ValueError('scratch descriptor is not a directory.')
    current = None
    try:
        current = os.stat('snapshot.wav', dir_fd=directory, follow_symlinks=False)
    except FileNotFoundError:
        pass
    if current is not None:
        if not expected_dev or not expected_ino or not stat.S_ISREG(current.st_mode) or (str(current.st_dev), str(current.st_ino)) != (expected_dev, expected_ino):
            raise ValueError('snapshot identity is unknown or changed; scratch retained.')
        os.unlink('snapshot.wav', dir_fd=directory)
    try:
        path_info = os.stat(scratch, follow_symlinks=False)
    except FileNotFoundError:
        raise ValueError('scratch path changed or moved; scratch retained.')
    if not stat.S_ISDIR(path_info.st_mode) or (path_info.st_dev, path_info.st_ino) != (identity.st_dev, identity.st_ino):
        raise ValueError('scratch path changed; scratch retained.')
    # rmdir refuses any replacement directory containing files; never recurse.
    os.rmdir(scratch)
    return {'removed': True}


def main(args):
    if args[0] == 'cleanup' and len(args) == 4:
        return cleanup(args[1], args[2], args[3])
    if args[0] == 'stage' and len(args) in (5, 6) and (len(args) == 5 or args[5] == '--scratch-fd'):
        return inspect(args[1], args[2], manifest=args[3], scratch=args[4], scratch_descriptor=3 if len(args) == 6 else None)
    if len(args) in (6, 8) and args[0] == 'prepare' and (len(args) == 6 or args[6] == '--output'):
        fps = float(args[4])
        if not re.fullmatch(r'[0-9]+', args[5]):
            raise ValueError('durationInFrames must be a positive integer.')
        return inspect(args[1], args[2], supplied={'version': 1, 'composition': args[3], 'fps': fps, 'durationInFrames': int(args[5])}, manifest_output=args[7] if len(args) == 8 else None)
    raise ValueError('usage: audio-snapshot.py stage PROJECT WAV MANIFEST SCRATCH | prepare PROJECT WAV COMPOSITION FPS FRAMES [--output MANIFEST]')


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, interrupted)
    try:
        print(json.dumps(main(sys.argv[1:]), allow_nan=False))
    except (OSError, ValueError, UnicodeError, json.JSONDecodeError) as error:
        print(f'Audio snapshot: {error}', file=sys.stderr)
        sys.exit(1)
