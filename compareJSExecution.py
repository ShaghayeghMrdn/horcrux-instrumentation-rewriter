#!/usr/bin/env python

"""
This module runs the log-trace-metrics.js node file
param1: Path to the top level directory containing all the traces
param2: path of the output directory

"""

__license__ = "GPL"
__version__ = "1.0.1"
__maintainer__ = "Ayush Goel"
__email__ = "goelayu@umich.edu"

import argparse
import os
import pickle
import demjson
import numpy as np

DOM_FILE = "DOM"
JS_FILE = "js_affect"

#Dictionary to hold all the js impact files
js_impact = {}

total_percentage = []

def buildDictOfVariables(tracePath):
    percentage_functions = []
    for root, folder, file in os.walk(tracePath):
        if len(file) >= 1:
            try:
                domInd = file.index(DOM_FILE)
                jsInd = file.index(JS_FILE)

                print "Parsing file ", root, file
                with open(os.path.join(root, file[jsInd]), 'r') as jsFile:
                    #root is in the form RTraces/1512742437/1/www.wunderground.com
                    key = "_".join(root.split('/')[2:]) # builds key in the format: 1_www.underground.com
                    js_dict = demjson.decode(jsFile.read()) #loads dictionary from the file
                    js_impact[key] = js_dict
                    total_count = 0 
                    count = 0
                    for item, value in js_dict.items():
                        total_count += 1
                        if isinstance(value, dict):
                            if not value:
                                count += 1
                    percentage_functions.append(count*1.0/total_count) 
            except ValueError as e:
                print "File not found", e
                # return
    print "Done loading the js impact dictionaries.."
    print percentage_functions
    print np.percentile(percentage_functions, 50)

    #create output path if it doesn't exist already

    filename = os.path.join(args.output,'/'.join(root.split('/')[:2]))
    try:
        os.makedirs(os.path.dirname(filename))
    except OSError as e:
        print "Output path exists"
    # print js_impact
    with open(filename,'w') as f:
        pickle.dump(js_impact, f, pickle.HIGHEST_PROTOCOL)

def _compareDictionaries(dict1, dict2):
    unmatched = tuple((key,value,dict2.get(key)) for key, value in dict2.items() if value != dict1.get(key))
    print "Total keys: ", len(dict2)
    print "Unmatched keys: ", len(unmatched)
    print "Percentage unmatched: ", len(unmatched)*1.0/len(dict2)

    total_percentage.append(len(unmatched)*1.0/len(dict2))
    print total_percentage
    print np.percentile(total_percentage, 50)
    with open("./percentage","w") as f:
        f.write("percentage \n")
        for item in total_percentage:
            f.write("%s\n" % item)

def compareDictionaries():
    js_impact_collection = {}

    with open(args.trace,'r') as f:
        js_impact_collection = pickle.load(f)

    total_keys = js_impact_collection.keys()
    d_length = len(total_keys)
    total_keys = list(total_keys)
    total_keys.sort()
    i=0
    while i < int(d_length/2):
        print "comparing ", total_keys[i], total_keys[i+int(d_length/args.num_iters)]
        print  "output: ", _compareDictionaries(js_impact_collection[total_keys[i]], js_impact_collection[total_keys[i+int(d_length/args.num_iters)]])
        i += 1



if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('trace', help="path to the list of traces")
    parser.add_argument('output', help="path to the output directory")
    parser.add_argument('num_iters',help="number of iterations in traces", type=int)
    parser.add_argument('--build',help="Build the python dictionary from all the js files")
    parser.add_argument('--compare', help="Compare the previously built python dict")
    args = parser.parse_args()

    if args.build:
        buildDictOfVariables(args.trace)

    if args.compare:
        compareDictionaries()
