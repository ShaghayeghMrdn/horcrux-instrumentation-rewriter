#!/usr/bin/env python
"""
This module is used to generate a stacked horizontal bar
of the breakdown of computation of page load times

"""

__license__ = "GPL"
__version__ = "1.0.1"
__maintainer__ = "Ayush Goel"
__email__ = "goelayu@umich.edu"

import re
import os
import pandas as pd
import argparse
import matplotlib.pyplot as plt

PerCategory = []


def extractWebsiteName(path):
    print "path to extract extractWebsiteNamesite from", path
    # regex = r"www.*\.com"
    # matches = re.findall(regex, path)

    # if len(matches) > 0:
    #     return matches
    return path.split('/')[2]


def dictFromFile(filename):
    categoryDict = {}
    with open(filename, 'r') as f:
        content = f.readlines()
        for line in content:
            data = line.split("=>")
            if len(data) > 1:
                categoryDict[data[0].strip().replace("'", "")] = re.findall(
                    r'\d+', data[1])[0]
    return categoryDict


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('traces', help="path to the list of traces")
    parser.add_argument('output', help="path to the output directory")
    args = parser.parse_args()

    scripting = {}
    loading = {}
    painting = {}
    rendering = {}

    # PerCategory.extend(scripting, loading, painting, rendering)
    for root, folder, files in os.walk(args.traces):
        if len(files) > 0 and files[1] == "PerCategory":
            categoryDict = dictFromFile(os.path.join(root, files[1]))
            website = extractWebsiteName(root)
            print categoryDict, website
            try:
                scripting[website] = int(categoryDict["scripting"])
                loading[website] = int(categoryDict["loading"])
                painting[website] = int(categoryDict["painting"])
                rendering[website] = int(categoryDict["rendering"])
            except KeyError as e:
                print e, "key was missing for ", website

    print scripting
    df = pd.DataFrame({
        "scripting": scripting.values(),
        "loading": loading.values(),
        "painting": painting.values(),
        "rendering": rendering.values()
    })
    ax = df.plot.barh(stacked=True)

    ax.set_title("Computation breakdown | alexa top news sports sites")
    ax.figure.set_size_inches(40, 40)
    ax.legend(loc="upper center")
    ax.set_xlabel("milliseconds")

    for index, key in enumerate(scripting):
        ax.annotate(key, (1500, index))

    plt.savefig(args.output + "/barchart.png")
