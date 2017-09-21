import sys
import cv2
import argparse
import mysql.connector
import code128
from PIL import Image

ROW_HEIGHT = 40
WORD_WIDTH = 25

# HEIGHT
DATE_BEGIN_HEIGHT = 710
ORDERID_BEGIN_HEIGHT = 1010
PARENTID_BEGIN_HEIGHT = 1060
SHIPTO_BEGIN_HEIGHT = 640
ITEM_BEGIN_HEIGHT = 1320
GIFT_BEGIN_HEIGHT = 1930

# WIDTH
DATE_BEGIN_WIDTH = 390
PARENTID_BEGIN_WIDTH = 1010
SHIPTO_BEGIN_WIDTH = 1600
IN_BEGIN_WIDTH = 140
UPC_BEGIN_WIDTH = 510
SKU_BEGIN_WIDTH = 950
ID_BEING_WIDTH = 1350
QTY_BEGIN_WIDTH = 2250
GM_BEGIN_WIDTH = 130

BARCODE_BOTTOM = 75

ITEM_DESCRIPTION_SENT_LENGTH = 42
GIFT_MESSAGE_SENT_LENGTH = 100


line_font = cv2.FONT_HERSHEY_SIMPLEX
line_aa = cv2.LINE_AA

def chunkstring(string, length):
    return [string[0+i:length+i] for i in range(0, len(string), length)]

def putText(img, info, width, height):
    cv2.putText(img, info, (width, height), line_font, 1, (0, 0, 0), 1, line_aa)

def toRatio(img):
    imgHeight = img.shape[0]
    imgWidth = img.shape[1]
    wantedHeight = int( imgWidth * 8 / 5.5 )
    tpad = int((wantedHeight - imgHeight) / 2)
    bpad = wantedHeight - imgHeight - tpad
    return cv2.copyMakeBorder(img, tpad, bpad, 0, 0, cv2.BORDER_CONSTANT, value = [255,255,255])

ps_template_path = 'C:\\Users\\TC710-Admin\\Desktop\\ayou7995\\SoundBot\\create_label\\PackingSlipTemplate.png';
# ps_template_path = '/home/ayou7995/NTUEE/8th_semester/SoundBot/create_label/PackingSlipTemplate.png';
if __name__ == '__main__':
    
    img = cv2.imread(ps_template_path, cv2.IMREAD_COLOR)
    shape = img.shape
 
    cnx = mysql.connector.connect(user='root', password='', database='groupondb')
    cursor = cnx.cursor(buffered=True)

    ps_data = sys.argv[1:]
    orderid = ps_data[1]
    cursor.execute("""  SELECT o.order_date, o.orderid, o.parent_orderid, 
                               ri.shipment_addr_name, ri.shipment_addr_street_1,
                               ri.shipment_addr_street_2, ri.shipment_addr_city,
                               ri.shipment_addr_state, ri.shipment_addr_zipcode,
                               oi.method, oi.fulfillment_id, p.upc, p.bom_sku, 
                               p.name, oi.quantity, oi.gift_message
                        FROM ORDERS as o
                        JOIN ORDERITEM as oi
                        ON o.orderid = oi.orderid 
                        JOIN PRODUCT as p
                        ON oi.bom_sku = p.bom_sku
                        JOIN RECEIVER_INFO as ri
                        ON oi.fulfillment_id = ri.fulfillment_id
                        WHERE o.orderid = '""" + orderid + "'")
    db_fetch_data = cursor.fetchall()

    if db_fetch_data:
        db_fetch_data = list(db_fetch_data[0])

        ps_data[0] = db_fetch_data[0]
        ps_data[5] = db_fetch_data[5]
        ps_data[9] = db_fetch_data[9]
        ps_data[11] = db_fetch_data[11]
        ps_data[13] = db_fetch_data[13]
        ps_data[15] = db_fetch_data[15]

        putText(img, ps_data[0].strftime('%Y-%m-%d'), DATE_BEGIN_WIDTH, DATE_BEGIN_HEIGHT)
        putText(img, ps_data[1], DATE_BEGIN_WIDTH, ORDERID_BEGIN_HEIGHT)
        putText(img, ps_data[2], PARENTID_BEGIN_WIDTH, PARENTID_BEGIN_HEIGHT)
        for i in range(3,9):
            width = SHIPTO_BEGIN_WIDTH
            height = SHIPTO_BEGIN_HEIGHT + i * ROW_HEIGHT
            if i == 7:
                width = width + len(ps_data[i-1]) * WORD_WIDTH
            if i >=7:
                height = height - ROW_HEIGHT
            putText(img, ps_data[i], width, height)
        putText(img, ps_data[9], SHIPTO_BEGIN_WIDTH, PARENTID_BEGIN_HEIGHT)
        putText(img, ps_data[10], IN_BEGIN_WIDTH, ITEM_BEGIN_HEIGHT)
        putText(img, ps_data[11], UPC_BEGIN_WIDTH, ITEM_BEGIN_HEIGHT)
        putText(img, ps_data[12], SKU_BEGIN_WIDTH, ITEM_BEGIN_HEIGHT)

        item_des = chunkstring(ps_data[13], ITEM_DESCRIPTION_SENT_LENGTH)
        for i in range(len(item_des)):
            putText(img, item_des[i], ID_BEING_WIDTH, ITEM_BEGIN_HEIGHT + ROW_HEIGHT * i)
        putText(img, str(ps_data[14]), QTY_BEGIN_WIDTH, ITEM_BEGIN_HEIGHT)

        gift_msg = chunkstring(ps_data[15], GIFT_MESSAGE_SENT_LENGTH)
        for i in range(len(gift_msg)):
            putText(img, gift_msg[i], GM_BEGIN_WIDTH, GIFT_BEGIN_HEIGHT + ROW_HEIGHT * i)

        labelImgHeight = img.shape[0]
        labelImgWidth = img.shape[1]

        # BARCODE
        barcode_path = '{0}/{1}_barcode.png'.format(ps_data[16],ps_data[17])
        code128.image(ps_data[1]).save(barcode_path)
        barcode_img = cv2.imread(barcode_path)
        
        barImgHeight = barcode_img.shape[0]
        barImgWidth = barcode_img.shape[1]

        lpad = int(( labelImgWidth - barImgWidth ) / 2)
        tpad = labelImgHeight - barImgHeight - BARCODE_BOTTOM
        img[tpad:tpad+barImgHeight, lpad:lpad+barImgWidth, :] = barcode_img
        img = toRatio(img)

    cv2.imwrite('{0}/{1}_{2}_ps.png'.format(ps_data[16], ps_data[17], ps_data[2]), img)
    cursor.close()

