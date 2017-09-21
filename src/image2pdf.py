import img2pdf
import glob
import sys
import os
import cv2
import argparse
import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from reportlab.lib.pagesizes import letter, A4, landscape
from os.path import join, basename

def parseArgs():
    parser = argparse.ArgumentParser(description='Combine packing slip and shipping label into pdf.') 
    parser.add_argument('--date', nargs='?', type=str, 
            default=datetime.datetime.now().strftime('%Y%m%d'),                         
            const=datetime.datetime.now().strftime('%Y%m%d'),                         
            help='Process raw order of a specific date')
    # parser.add_argument('--image-path', type=str, help='specify where PS and SL are')
    args = parser.parse_args() 
    return args

if __name__ == '__main__':
    # label_inpt = (img2pdf.mm_to_pt(140),img2pdf.mm_to_pt(216))
    # layout_fun = img2pdf.get_layout_fun(label_inpt)
    args = parseArgs()
    today = args.date
    image_path = join("C:\\Users\\TC710-Admin\\Dropbox\\GrouponOrders\\labels",today,"image\\")

    pdf_path = join(image_path, '../')
    # if not os.path.isdir(pdf_path):
    #     os.mkdir(pdf_path)
    
    images = glob.glob(join(image_path,'*.png'))

    item_dict_ = {}
    for image in images:
        img_file = basename(image)
        res_num = img_file.strip().split('_')[0]
        if 'ps' not in img_file and 'sl' not in img_file:
            continue
        if res_num in item_dict_:
            item_dict_[res_num].append(img_file)
        else:
            item_dict_[res_num] = [img_file]
    # print(item_dict_)
    for res, list_ in item_dict_.items():
        if len(list_) != 2:
            print('{0} has missing png image'.format(str(res)))
            continue
        pdf_name = '_'.join(list_[0].strip().split('_')[:2]) + '.pdf'
        pdf_save_path = join(pdf_path, pdf_name)
        c = canvas.Canvas(pdf_save_path, pagesize=(792, 576))
        for img_file in list_:
            img_path = join(image_path, img_file)
            shape = cv2.imread(img_path).shape
            if 'sl' in img_file:
                c.drawImage(img_path, 0, 0, 396, 576) 
            elif 'ps' in img_file:
                c.drawImage(img_path, 396, 0, 396, 576)
        c.save()
        # imgname = basename(image)
        # with open(join(pdf_path,imgname.replace('png', 'pdf')), "wb") as f:
            # f.write(img2pdf.convert(image, layout_fun=layout_fun))

