"""Prevent an outside project from writing the engine's shared generated audio."""
import os


def require_local_output(engine, spec, output_is_shared=True):
    if not output_is_shared:
        return
    root = os.path.realpath(engine)
    project = os.environ.get('FRAMEFORGE_PROJECT')
    source = os.path.realpath(spec)
    try:
        outside = os.path.commonpath([root, source]) != root
    except ValueError:  # Different drives on Windows are outside the engine.
        outside = True
    # A project nested inside the engine is still a separate project when a
    # user invokes the Python script directly without FRAMEFORGE_PROJECT.
    folder = os.path.dirname(source)
    nested_project = False
    while not outside and folder != root:
        if os.path.lexists(os.path.join(folder, 'frameforge.json')):
            nested_project = True
            break
        parent = os.path.dirname(folder)
        if parent == folder:
            break
        folder = parent
    if (project and os.path.realpath(project) != root) or outside or nested_project:
        raise SystemExit('External project generated audio is disabled: the engine output is shared and could overwrite another project. Use explicitly supplied audio or a full-mix snapshot; project-isolated generation is not yet supported.')
