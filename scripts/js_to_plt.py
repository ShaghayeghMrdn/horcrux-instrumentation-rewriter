import os
import json
import re

for root, folder, files in os.walk("/home/goelayu/research/WebPeformance/data/poutput_random_120"):
	if len(files) == 3:
		catFile = open(root+"/" + files[0],"r").readlines()
		categories = {}
		for line in catFile:
			if "map" not in line.lower():
                                categories = json.loads(line)
				#categories[line.split("=>")[0].strip()] =  float(re.findall( r'\d+\.*\d*', line)[0])
		plt = open(root + "/" + files[2] ,"r").readlines()
		plt_j = json.loads(plt[0].split("\t")[1])
		try:
			#print sum(categories.values())/plt_j['loadTime']
                        #print categories['scripting']/sum(categories.values())
                        #print categories
                        print float(categories['JS Frame'])/sum([float(i) for i in categories.values()]) 
		except:
			a=1
