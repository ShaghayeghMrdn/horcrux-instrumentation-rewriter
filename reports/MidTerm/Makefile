FILE = paper

all: 
	rm -f $(FILE).aux $(FILE).bbl $(FILE).blg $(FILE).log $(FILE).dvi $(FILE).ps $(FILE).out $(FILE).thm
	pdflatex $(FILE)
	bibtex $(FILE)
	pdflatex $(FILE)
	pdflatex $(FILE)
	open -a Preview $(FILE).pdf &

clean:
	rm -f $(FILE).aux $(FILE).bbl $(FILE).blg $(FILE).log $(FILE).pdf $(FILE).dvi $(FILE).ps $(FILE).out

view: all
	open -a Preview $(FILE).pdf &
