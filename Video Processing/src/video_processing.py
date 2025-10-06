import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
# import seborn as sns
import os
import cv2
import sunpy.map
import matplotlib.pyplot as plt
from astropy.io import fits
import matplotlib.pyplot as plt

def video_gen(path):
    import cv2
    import os

    # Folder containing your 91 sun images
    image_folder = path
    output_video = 'sun_video.avi'
    images = [img for img in sorted(os.listdir(image_folder)) if img.endswith('.png') or img.endswith('.jpg')]
    frame = cv2.imread(os.path.join(image_folder, images[0]))
    height, width, layers = frame.shape
    video = cv2.VideoWriter(output_video, cv2.VideoWriter_fourcc(*'XVID'), 10, (width, height))  # 10 FPS
    for image in images:
        image_path = os.path.join(image_folder, image)
        frame = cv2.imread(image_path)
        video.write(frame)

    video.release()

    print("Video creation completed: ", output_video)

def fits_video(path):
    import os
    import sunpy.map
    import matplotlib.pyplot as plt

    # Create output folder for JPGs
    output_folder = os.path.join(path, "jpg_output")
    os.makedirs(output_folder, exist_ok=True)

    # Loop through all FITS files
    for image in os.listdir(path):
        if image.lower().endswith(('.fits', '.fit')):
            image_path = os.path.join(path, image)
            amap = sunpy.map.Map(image_path)

            # Plot and save as JPG
            fig = plt.figure(figsize=(6, 6))
            amap.plot(cmap='inferno', vmin=100, vmax=6e4)
            amap.draw_grid()
            plt.title(image)

            # Save image
            output_name = os.path.splitext(image)[0] + ".jpg"
            output_path = os.path.join(output_folder, output_name)
            plt.savefig(output_path, format='jpg', dpi=150, bbox_inches='tight')
            plt.close(fig)

    video_gen(output_path)


video_gen('fit_data/jpg_output')