import cv2
import sys
import imghdr
from PIL import Image

def toRatio(img):
    imgHeight = img.shape[0]
    imgWidth = img.shape[1]
    wantedWidth = int( imgHeight * 5.5 / 8 )
    lpad = int((wantedWidth - imgWidth) / 2)
    rpad = wantedWidth - imgWidth - lpad
    return cv2.copyMakeBorder(img, 0, 0, lpad, rpad, cv2.BORDER_CONSTANT, value = [255,255,255])

if __name__ == '__main__':

    ref_1 = sys.argv[1]
    ref_2 = sys.argv[2]
    ref_3 = sys.argv[3]
    ref_4 = sys.argv[4]
    ref_5 = sys.argv[5]
    shipping_label_path = sys.argv[6]

    # rotate image
    img = Image.open(shipping_label_path).rotate(-90, expand=True)
    img.save(shipping_label_path, 'png')

    # add reference
    img = cv2.imread(shipping_label_path, cv2.IMREAD_COLOR)
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
    img = toRatio(img)
    
    cv2.imwrite(shipping_label_path, img)
