from bs4 import BeautifulSoup
import argparse


def main(args):
    f = open(args.input).read()
    try:
         BeautifulSoup(f, 'html5lib')
         return 0
    except:
        return 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('input', help='path to input directory')
    args = parser.parse_args()
    print main(args)