import img2pdf
import glob
import sys
import os
from os.path import join, basename

if __name__ == '__main__':
    label_inpt = (img2pdf.mm_to_pt(140),img2pdf.mm_to_pt(216))
    layout_fun = img2pdf.get_layout_fun(label_inpt)
    image_path = sys.argv[1]
    pdf_path = join(image_path, 'pdf/')
    if not os.path.isdir(pdf_path):
        os.mkdir(pdf_path)
    
    images = glob.glob(join(image_path,'*.png'))
    for image in images:
        imgname = basename(image)
        with open(join(pdf_path,imgname.replace('png', 'pdf')), "wb") as f:
            f.write(img2pdf.convert(image, layout_fun=layout_fun))
