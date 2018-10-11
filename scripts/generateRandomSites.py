import random
import sys
alreadySeen = []
sites = open(sys.argv[1],"r")

sites = sites.readlines()

rSites = []
for i in range(100):
        index  = random.randint(0,1000)
        while index in alreadySeen:
            index = random.randint(0,1000)
        rSites.append(sites[index])
 

rSitesFile = open(sys.argv[2],"w")
for rsite in rSites:
    rSitesFile.write(rsite)

rSitesFile.close()
