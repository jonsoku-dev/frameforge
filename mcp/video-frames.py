#!/usr/bin/env python3
"""Decode selected frames from a project-local MP4 without following path symlinks."""

import base64
import hashlib
import json
import os
import re
import resource
import stat
import subprocess
import sys
import tempfile

MAX_LOG = 4 * 1024 * 1024
MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_CHILD_FILE = 16 * 1024 * 1024


def limit_child_files():
    resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_CHILD_FILE, MAX_CHILD_FILE))


def media_command(command, fd, scratch):
    # Bound both captured streams and each generated file without buffering untrusted logs in memory.
    with tempfile.TemporaryFile(dir=scratch) as output, tempfile.TemporaryFile(dir=scratch) as errors:
        result = subprocess.run(command, stdin=subprocess.DEVNULL, stdout=output, stderr=errors,
                                pass_fds=(fd,), timeout=60, check=False, preexec_fn=limit_child_files)
        output.seek(0)
        errors.seek(0)
        stdout, stderr = output.read(MAX_LOG + 1), errors.read(MAX_LOG + 1)
        if len(stdout) > MAX_LOG or len(stderr) > MAX_LOG:
            raise ValueError('Media inspection log limit exceeded.')
        if result.returncode:
            raise ValueError(f'Media inspection failed (exit {result.returncode}): {stderr.decode(errors="replace")[-1500:]}')
        return stdout.decode(errors='replace'), stderr.decode(errors='replace')


def inspect(root, video, frames, max_dimension, scratch):
    if os.name != 'posix' or not hasattr(os, 'O_NOFOLLOW') or not hasattr(os, 'O_DIRECTORY') or not os.path.isdir('/dev/fd'):
        raise ValueError('Saved-video frame inspection requires POSIX openat and /dev/fd support.')
    if not video or '\x00' in video:
        raise ValueError('video must be a project-local MP4 path.')
    if '..' in video.split(os.sep):
        raise ValueError('video path must not contain .. components.')
    root = os.path.realpath(root)
    if os.path.isabs(video):
        requested = os.path.abspath(video)
        ancestor = os.path.dirname(requested)
        root_alias = None
        # Only resolve ancestors to identify a project-root alias. Pick the
        # outermost match so an internal symlink back to root remains in the
        # relative suffix and is rejected by the no-follow walk below.
        while True:
            if os.path.realpath(ancestor) == root:
                root_alias = ancestor
            parent = os.path.dirname(ancestor)
            if parent == ancestor:
                break
            ancestor = parent
        if root_alias is None:
            raise ValueError('video must be inside the project.')
        path = os.path.join(root, os.path.relpath(requested, root_alias))
    else:
        path = os.path.abspath(os.path.join(root, video))
    relative = os.path.relpath(path, root)
    if relative == '.' or relative == '..' or relative.startswith('..' + os.sep) or os.path.isabs(relative):
        raise ValueError('video must be inside the project.')
    if os.path.splitext(path)[1].lower() != '.mp4':
        raise ValueError('video must be an MP4 file.')
    if not isinstance(frames, list) or not 1 <= len(frames) <= 8 or any(type(n) is not int or n < 0 or n > 1_000_000 for n in frames):
        raise ValueError('frames must contain 1–8 integers from 0 to 1000000.')
    if type(max_dimension) is not int or not 64 <= max_dimension <= 1280:
        raise ValueError('max_dimension must be an integer from 64 to 1280.')
    frames = sorted(set(frames))
    opened = []
    try:
        # openat on every component prevents a concurrent parent-directory symlink swap from escaping the project.
        directory = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        opened.append(directory)
        original_root = os.fstat(directory)
        parts = relative.split(os.sep)
        for part in parts[:-1]:
            directory = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
            opened.append(directory)
        fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
        opened.append(fd)
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode):
            raise ValueError('video must be a regular MP4 file.')
        digest = hashlib.sha256()
        with os.fdopen(os.dup(fd), 'rb') as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b''):
                digest.update(chunk)
        os.lseek(fd, 0, os.SEEK_SET)
        ffmpeg = os.environ.get('FFMPEG_PATH') or 'ffmpeg'
        ffprobe = os.environ.get('FFPROBE_PATH') or re.sub(r'ffmpeg$', 'ffprobe', ffmpeg)
        input_options = ['-protocol_whitelist', 'file,pipe', '-f', 'mov', '-enable_drefs', '0']
        descriptor_path = f'/dev/fd/{fd}'
        stdout, _ = media_command([ffprobe, '-v', 'error', *input_options, '-select_streams', 'v:0', '-show_entries',
                                   'stream=width,height,avg_frame_rate', '-of', 'json', descriptor_path], fd, scratch)
        streams = json.loads(stdout).get('streams', [])
        if not streams or not streams[0].get('width') or not streams[0].get('height'):
            raise ValueError('No video stream found.')
        stream = streams[0]
        os.lseek(fd, 0, os.SEEK_SET)
        with tempfile.TemporaryDirectory(prefix='decoded-', dir=scratch) as directory:
            select = '+'.join(f'eq(n\\,{frame})' for frame in frames)
            _, stderr = media_command([ffmpeg, '-hide_banner', '-nostdin', '-v', 'info', *input_options, '-copyts', '-i', descriptor_path,
                                       '-map', '0:v:0', '-an', '-sn', '-dn', '-vf',
                                       f'select={select},showinfo,scale={max_dimension}:{max_dimension}:force_original_aspect_ratio=decrease',
                                       '-vsync', '0', '-frames:v', str(len(frames)), os.path.join(directory, 'frame-%03d.png')], fd, scratch)
            times = re.findall(r'\bn:\s*\d+\s+pts:\s*(?:-?\d+|NOPTS)\s+pts_time:\s*([-+\d.eE]+|N/A)', stderr)
            if len(times) != len(frames):
                raise ValueError('One or more requested frames were not decoded, or their timestamps could not be read.')
            images, total = [], 0
            for index, (frame, timestamp) in enumerate(zip(frames, times), start=1):
                with open(os.path.join(directory, f'frame-{index:03}.png'), 'rb') as image:
                    data = image.read(MAX_IMAGE_BYTES + 1)
                total += len(data)
                if total > MAX_IMAGE_BYTES:
                    raise ValueError('Selected images exceed the 12 MiB output limit; reduce max_dimension or frame count.')
                images.append({'frame': frame, 'timestampSeconds': None if timestamp == 'N/A' else float(timestamp),
                               'data': base64.b64encode(data).decode('ascii')})
        after = os.fstat(fd)
        if (after.st_size, after.st_mtime_ns, after.st_ctime_ns) != (before.st_size, before.st_mtime_ns, before.st_ctime_ns):
            raise ValueError('video changed during inspection.')
        # Reopen the current root first: walking only the original root descriptor
        # would miss replacement of the directory named by the reported path.
        verify_directory = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        opened.append(verify_directory)
        verify_root = os.fstat(verify_directory)
        if (verify_root.st_dev, verify_root.st_ino) != (original_root.st_dev, original_root.st_ino):
            raise ValueError('project root changed during inspection.')
        # Walk from that verified root without following symlinks, then ensure
        # the reported path still identifies the file read by the decoder.
        for part in parts[:-1]:
            verify_directory = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=verify_directory)
            opened.append(verify_directory)
        verify_fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=verify_directory)
        opened.append(verify_fd)
        verified = os.fstat(verify_fd)
        if (verified.st_dev, verified.st_ino) != (before.st_dev, before.st_ino):
            raise ValueError('video path changed during inspection.')
        return {'source': {'path': path, 'sha256': digest.hexdigest(), 'bytes': before.st_size,
                           'width': stream['width'], 'height': stream['height'], 'averageFrameRate': stream.get('avg_frame_rate')}, 'images': images}
    except OSError as error:
        raise ValueError(f'Cannot open project-local MP4 without following symlinks: {error.strerror}') from error
    finally:
        for fd in reversed(opened):
            os.close(fd)


if __name__ == '__main__':
    try:
        result = inspect(sys.argv[1], sys.argv[2], json.loads(sys.argv[3]), int(sys.argv[4]), sys.argv[5])
        print(json.dumps(result, allow_nan=False))
    except (ValueError, OSError, subprocess.SubprocessError, IndexError, json.JSONDecodeError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
