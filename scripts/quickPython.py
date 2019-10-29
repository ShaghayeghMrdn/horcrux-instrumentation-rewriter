import os
import sys

data = {}
allurls = []
matchedurls = []
for root, folder, files in os.walk(sys.argv[1]):
	key=root.split('/')[-2]
	if key not in data:
		data[key] = [0,0]
		# data[key+"_t"] = 0
	for file in files:
		if file == "info":
			val = open(os.path.join(root,file),'r').readline()
			if len(val.split()) > 1:
				totalnodes = float(val.split()[1])
				matchedndoes = float(val.split()[2])
				data[key][0] = data[key][0]+ totalnodes
				data[key][1] = data[key][1] + matchedndoes
				# print root, val.split()

for key in data:
	sys.stdout.write(str(data[key]))
	sys.stdout.flush()
	print " " +key
# print allurls
# print matchedurls
# print ""