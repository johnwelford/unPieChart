import sys
#sys.path
from cv2.cv import *
import numpy as np
import cv2,urllib
import web

urls = (
  '/unPieChart', 'Index'
)

app = web.application(urls, globals())

render = web.template.render('')

class Index(object):  
    def POST(self):
        form = web.input(pieUrl="Hello")
#def extractPieData(file = "http://www.turkishculturalfoundation.org/images/Annual%20Report%202008/PIE%20CHART%20MAR16%20FINALTCA2.jpg")
  #file = "testPie.jpg"
 	urllib.urlretrieve(form.pieUrl,"test")
  #img = LoadImage("test")
  #NamedWindow("opencv")
  #ShowImage("opencv",img)
  #WaitKey(0)
#  img = cv2.imread("test")
#  h = np.zeros((300,256,3))
  
#  bins = np.arange(256).reshape(256,1)
#  color = [ (255,0,0),(0,255,0),(0,0,255) ]
#  for ch, col in enumerate(color):
#      hist_item = cv2.calcHist([img],[ch],None,[256],[0,256])
#      cv2.normalize(hist_item,hist_item,0,255,cv2.NORM_MINMAX)
#      hist=np.int32(np.around(hist_item))
#      pts = np.column_stack((bins,hist))
      #cv2.polylines(h,[pts],False,col)
  
#  print pts 
  #h=np.flipud(h) 
  #cv2.imshow('colorhist',h)
  #cv2.waitKey(0)
  
        returnData = "%s" % (form.pieUrl)
        return render.unPieChart(pieChartData = returnData)

if __name__ == "__main__":
    app.run()




