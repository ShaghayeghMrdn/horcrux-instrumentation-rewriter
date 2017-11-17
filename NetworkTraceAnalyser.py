#!/usr/bin/env python

"""
Summarizes the network traces over the entire
corpus of websites the experiment was run for. 
"""

__license__ = "GPL"
__version__ = "1.0.1"
__maintainer__ = "Ayush Goel"
__email__ = "goelayu@umich.edu"


import os
import json
import argparse



if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('trace', help="path to the network trace directory")
    args = parser.parse_args()

    totalObjectsFetched = 0
    totalJSFetched = 0
    totalCSSFetched = 0

    totalCacheableObjects = 0
    totalCacheableJS = 0
    totalCacheableCSS = 0

    totalCacheHits = 0
    totalCacheHitsJS = 0
    totalCacheHitsCSS = 0


    for root, folder, file in os.walk(args.trace):
        file.sort()
        if len(file) > 0:
            f = open(os.path.join(root, file[0]),"r")
            data = f.readlines()
            for line in data:
                js = json.loads(line)
                if "Network.responseReceived" in js:
                   totalObjectsFetched += 1

                   if js["Network.responseReceived"]["response"]["url"].endswith(".js"):
                         totalJSFetched += 1
                         if "Cache-Control" in js["Network.responseReceived"]["response"]["headers"]:
                            totalCacheableJS += 1
                         if js["Network.responseReceived"]["response"]["fromDiskCache"]:
                               # print js["Network.responseReceived"]["response"]["url"]
                               totalCacheHitsJS += 1

                   if ".css" in js["Network.responseReceived"]["response"]["url"]:
                         totalCSSFetched += 1
                         if "Cache-Control" in js["Network.responseReceived"]["response"]["headers"]:
                            totalCacheableCSS += 1
                         if js["Network.responseReceived"]["response"]["fromDiskCache"]:
                               totalCacheHitsCSS += 1

                   if "Cache-Control" in js["Network.responseReceived"]["response"]["headers"]:
                        totalCacheableObjects += 1

                   if js["Network.responseReceived"]["response"]["fromDiskCache"]:
                        # print js["Network.responseReceived"]["response"]["url"]
                        totalCacheHits += 1


    print "Stats from the network trace..\n"
    print "******Fetch Information******\n"
    print "Total Objects: " + str(totalObjectsFetched) + "\n"
    print "Total JS fetched: " + str(totalJSFetched) + "\n"
    print "Total CSS Fetched: " + str(totalCSSFetched) + "\n"
    print "******Cacheable Objects Information******\n"
    print "Total Objects Cacheable: " + str(totalCacheableObjects) + "\n"
    print "Total JS Cacheable: " + str(totalCacheableJS) + "\n"
    print "Total CSS Cacheable: " + str(totalCacheableCSS) + "\n"
    print "******Catch hit Information******\n"
    print "Total Objects Hits: " + str(totalCacheHits) + "\n"
    print "Total JS Hits: " + str(totalCacheHitsJS) + "\n"
    print "Total CSS Hits: " + str(totalCacheHitsCSS) + "\n"

