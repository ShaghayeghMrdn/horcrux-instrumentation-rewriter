import os
import json
import argparse
from Naked.toolshed.shell import execute_js

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('trace', help="path to the list of traces") #the top level trace directory
    parser.add_argument('output', help="path to the output directory")
    args = parser.parse_args()

    for root, folder, file in os.walk(args.trace):
        if len(file) >= 1:
            with open(os.path.join(root, file[0]), 'r') as traceFile:
                try:
                    json.load(traceFile)
                    execute_js("log-trace-metrics.js","-p " + traceFile.name + " -o " + os.path.join(args.output,traceFile.name))
                except ValueError, e:
                    print "Invalid jason file " + root + "/" + os.path.join(root, file[0]) + " hencing skipping"