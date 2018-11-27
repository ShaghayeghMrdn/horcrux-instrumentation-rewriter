import random
import sys
alreadySeen = []
sites = open(sys.argv[1],"r")
number = int(sys.argv[2])
sites = sites.readlines()

rSites = []
for i in range(number):
        index  = random.randint(0,100)
        while index in alreadySeen:
            index = random.randint(0,100)
        rSites.append(sites[index])
 

rSitesFile = open(sys.argv[3],"w")
for rsite in rSites:
    rSitesFile.write(rsite)

rSitesFile.close()
