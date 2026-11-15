import os
import zipfile

def create_bundle():
    bundle_filename = "ExamCraft_AI_Review_Bundle.zip"
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    bundle_path = os.path.join(root_dir, bundle_filename)

    if os.path.exists(bundle_path):
        os.remove(bundle_path)

    exclude_dirs = {
        ".venv",
        "node_modules",
        ".git",
        "__pycache__",
        ".pytest_cache",
        ".turbo",
        ".cache",
    }

    exclude_extensions = {
        ".pyc",
        ".pyo",
        ".pyd",
    }

    print(f"Creating review bundle at: {bundle_path}")
    count = 0

    with zipfile.ZipFile(bundle_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for foldername, subfolders, filenames in os.walk(root_dir):
            # Prune excluded directories in-place
            subfolders[:] = [
                d for d in subfolders
                if d not in exclude_dirs and not d.endswith(".egg-info")
            ]

            # Don't include root zipfile itself or files in excluded dirs
            rel_folder = os.path.relpath(foldername, root_dir)
            if any(part in exclude_dirs for part in rel_folder.split(os.sep)):
                continue

            for filename in filenames:
                if filename == bundle_filename:
                    continue
                ext = os.path.splitext(filename)[1].lower()
                if ext in exclude_extensions:
                    continue

                full_path = os.path.join(foldername, filename)
                rel_path = os.path.relpath(full_path, root_dir)

                zipf.write(full_path, rel_path)
                count += 1

    size_mb = os.path.getsize(bundle_path) / (1024 * 1024)
    print(f"Created {bundle_filename} successfully: {count} files, {size_mb:.2f} MB")

if __name__ == "__main__":
    create_bundle()
