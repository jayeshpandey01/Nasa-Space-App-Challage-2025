import os
import json
import sunpy.map
from astropy.io import fits
import matplotlib.pyplot as plt

import cv2
import os

def create_video_from_images(image_folder, output_video="output.mp4", fps=5):
    """
    Create a video from images in a folder.
    You can increase duration by lowering the FPS.
    """
    images = [img for img in sorted(os.listdir(image_folder)) if img.endswith(".jpg")]
    if not images:
        print("No images found in folder.")
        return

    # Read first image to get size
    first_image = cv2.imread(os.path.join(image_folder, images[0]))
    height, width, _ = first_image.shape

    # Define video writer
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    video = cv2.VideoWriter(output_video, fourcc, fps, (width, height))

    # Write each frame
    for image_name in images:
        img_path = os.path.join(image_folder, image_name)
        frame = cv2.imread(img_path)
        video.write(frame)

    video.release()
    print(f"✅ Video saved: {output_video}")
    print(f"🎞️ Total frames: {len(images)}, FPS: {fps}, Duration ≈ {len(images)/fps:.2f}s")


def fits_folder_to_jpg(folder_path):
    """
    Converts all FITS files in a folder to JPG images
    and saves their metadata into a single JSON file.
    Assumes all data belong to the same day.
    """
    metadata_list = []

    # Ensure output folders exist
    output_img_dir = os.path.join(folder_path, "jpg_output")
    os.makedirs(output_img_dir, exist_ok=True)

    # Loop through all FITS files in the folder
    for filename in os.listdir(folder_path):
        if not filename.lower().endswith(".fits"):
            continue

        fits_path = os.path.join(folder_path, filename)

        # Open and patch header
        with fits.open(fits_path) as hdul:
            hdr = hdul[0].header
            for key in hdr:
                if isinstance(hdr[key], str) and 'milli-angstrom' in hdr[key]:
                    hdr[key] = hdr[key].replace('milli-angstrom', 'angstrom')
            hdr['CUNIT1'] = 'arcsec'
            observer = sunpy.map.Map(hdul[0].data, hdr)

        # ---- Save image ----
        fig = plt.figure()
        ax = plt.subplot(projection=observer)
        observer.plot()
        observer.draw_grid()

        # JPG output path
        jpg_name = os.path.splitext(filename)[0] + ".jpg"
        jpg_path = os.path.join(output_img_dir, jpg_name)

        plt.savefig(jpg_path, dpi=300, bbox_inches='tight')
        plt.close(fig)

        # ---- Extract useful metadata ----
        metadata = {
            "file_name": filename,
            "date_obs": hdr.get("DATE-OBS", "Unknown"),
            "instrument": hdr.get("INSTRUME", "Unknown"),
            "wavelength": str(hdr.get("WAVELNTH", "Unknown")),
            "exposure_time": str(hdr.get("EXPTIME", "Unknown")),
            "observer": hdr.get("OBSERVER", "Aditya L-1"),
            "jpg_path": jpg_path
        }
        metadata_list.append(metadata)

    # ---- Save all metadata as JSON ----
    json_output_path = os.path.join(folder_path, "fits_metadata.json")
    with open(json_output_path, "w") as f:
        json.dump(metadata_list, f, indent=4)

    print(f"✅ Conversion complete!")
    print(f"🖼️ Images saved in: {output_img_dir}")
    print(f"📄 Metadata saved as: {json_output_path}")
    create_video_from_images('output_img_dir')

fits_folder_to_jpg('suit_data')