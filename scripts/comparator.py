import os
import re
import sys
import subprocess
import json

for root, folder, files in os.walk(sys.argv[1]):
	if len(files)==7:
		print files
		plt = open(root + "/" + files[4] ,"r").readlines()
		catFile = open(root+"/" + files[3],"r").readlines()
		categories = {}
		for line in catFile:
       	        	 if "map" not in line.lower():
               			 categories[line.split("=>")[0].strip()] =  float(re.findall( r'\d+\.*\d*', line)[0])
		#print plt
		
 		total = sum(categories.values())
		#print "categories sum", total
		#plt_j = json.loads(plt[0])['loadTime']
		#print plt_j
		proc = subprocess.Popen("node comparator.js {} {} {} {}".format(root + "/" + files[0], root + "/" + files[1], sys.argv[2], total), shell=True)
		#proc.wait()
