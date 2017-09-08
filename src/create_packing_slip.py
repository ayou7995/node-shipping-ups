import sys
import cv2
import argparse
import mysql.connector
from PIL import Image

ROW_HEIGHT = 40
WORD_WIDTH = 25

# HEIGHT
DATE_BEGIN_HEIGHT = 710
ORDERID_BEGIN_HEIGHT = 1010
PARENTID_BEGIN_HEIGHT = 1060
SHIPTO_BEGIN_HEIGHT = 640
ITEM_BEGIN_HEIGHT = 1370
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


ITEM_DESCRIPTION_SENT_LENGTH = 42
GIFT_MESSAGE_SENT_LENGTH = 100


line_font = cv2.FONT_HERSHEY_SIMPLEX
line_aa = cv2.LINE_AA

def chunkstring(string, length):
    return [string[0+i:length+i] for i in range(0, len(string), length)]

def putText(template, info, width, height):
    cv2.putText(template, info, (width, height), line_font, 1, (0, 0, 0), 1, line_aa)

if __name__ == '__main__':
    
    template = cv2.imread('../PackingSlipTemplate.png', cv2.IMREAD_COLOR)
    shape = template.shape
 
    cnx = mysql.connector.connect(user='root', password='', database='soundbotdb')
    cursor = cnx.cursor(buffered=True)

    orderid = 'GG-179Z-R9WT-31Z9-FML5'
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
    pl_data = cursor.fetchall()

    if pl_data:
        pl_data = list(pl_data[0])
        # pl_data[15] = ','.join([str(i) for i in range(200)])
        putText(template, pl_data[0].strftime('%Y-%m-%d'), DATE_BEGIN_WIDTH, DATE_BEGIN_HEIGHT)
        putText(template, pl_data[1], DATE_BEGIN_WIDTH, ORDERID_BEGIN_HEIGHT)
        putText(template, pl_data[2], PARENTID_BEGIN_WIDTH, PARENTID_BEGIN_HEIGHT)
        for i in range(3,9):
            width = SHIPTO_BEGIN_WIDTH
            height = SHIPTO_BEGIN_HEIGHT + i * ROW_HEIGHT
            if i == 7:
                width = width + len(pl_data[i-1]) * WORD_WIDTH
            if i >=7:
                height = height - ROW_HEIGHT
            putText(template, pl_data[i], width, height)
        putText(template, pl_data[9], SHIPTO_BEGIN_WIDTH, PARENTID_BEGIN_HEIGHT)
        putText(template, pl_data[10], IN_BEGIN_WIDTH, ITEM_BEGIN_HEIGHT)
        putText(template, pl_data[11], UPC_BEGIN_WIDTH, ITEM_BEGIN_HEIGHT)
        putText(template, pl_data[12], SKU_BEGIN_WIDTH, ITEM_BEGIN_HEIGHT)

        item_des = chunkstring(pl_data[13], ITEM_DESCRIPTION_SENT_LENGTH)
        for i in range(len(item_des)):
            putText(template, item_des[i], ID_BEING_WIDTH, ITEM_BEGIN_HEIGHT + ROW_HEIGHT * i)
        putText(template, str(pl_data[14]), QTY_BEGIN_WIDTH, ITEM_BEGIN_HEIGHT)

        gift_msg = chunkstring(pl_data[15], GIFT_MESSAGE_SENT_LENGTH)
        for i in range(len(gift_msg)):
            putText(template, gift_msg[i], GM_BEGIN_WIDTH, GIFT_BEGIN_HEIGHT + ROW_HEIGHT * i)

    cv2.imwrite('test_packing_slip.png', template)
    cursor.close()

