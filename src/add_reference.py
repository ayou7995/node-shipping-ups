import cv2
import sys
import imghdr
from PIL import Image

if __name__ == '__main__':

    gif_name = sys.argv[1]
    ref_1 = sys.argv[2]
    ref_2 = sys.argv[3]
    ref_3 = sys.argv[4]
    ref_4 = sys.argv[5]
    ref_5 = sys.argv[6]
    png_name = gif_name.replace('gif','png') 

    # gif to png
    img = Image.open(gif_name).rotate(-90, expand=True)
    img.save(png_name, 'png')

    # add reference
    img = cv2.imread(png_name, cv2.IMREAD_COLOR)
    shape = img.shape
    img = cv2.copyMakeBorder(img, 0, 300, 0, 0, cv2.BORDER_CONSTANT, value = [255,255,255])
    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(img,'Reference Number 1',(20,shape[0]), font, 0.5, (0,0,0), 1, cv2.LINE_AA)
    cv2.putText(img,ref_1,(80,shape[0]+30), font, 0.7, (0,0,0), 1, cv2.LINE_AA)
    cv2.putText(img,'Reference Number 2',(20,shape[0]+60), font, 0.5, (0,0,0), 1, cv2.LINE_AA)
    cv2.putText(img,ref_2,(80,shape[0]+90), font, 0.7, (0,0,0), 1, cv2.LINE_AA)
    cv2.putText(img,'Reference Number 3',(20,shape[0]+120), font, 0.5, (0,0,0), 1, cv2.LINE_AA)
    cv2.putText(img,ref_3,(80,shape[0]+150), font, 0.7, (0,0,0), 1, cv2.LINE_AA)
    cv2.putText(img,'Reference Number 4',(20,shape[0]+180), font, 0.5, (0,0,0), 1, cv2.LINE_AA)
    cv2.putText(img,ref_4,(80,shape[0]+210), font, 0.7, (0,0,0), 1, cv2.LINE_AA)
    cv2.putText(img,'Reference Number 5',(20,shape[0]+240), font, 0.5, (0,0,0), 1, cv2.LINE_AA)
    cv2.putText(img,ref_5,(80,shape[0]+270), font, 0.7, (0,0,0), 1, cv2.LINE_AA)
    cv2.imwrite(png_name, img)
