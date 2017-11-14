\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{ns-article-compact}[2003/06/21 Neil Spring, UW CSE]
\LoadClass[twocolumn,10pt]{article} 

\RequirePackage{times}
%\RequirePackage{url}
\RequirePackage{comment}
\RequirePackage{pifont}
\RequirePackage{amsmath}
\RequirePackage{multirow}
\RequirePackage{latexsym}
\RequirePackage{ifpdf}

\ifpdf
  \usepackage[pdftex]{graphicx}
\else
  \usepackage{graphicx}
\fi

% portions from sig-alternate.cls by G.K.M. Tobin, Gerry Murray, et al.
\oddsidemargin 1in
\evensidemargin 1in
\advance\oddsidemargin by -1in  % Correct for LaTeX gratuitousness
\advance\evensidemargin by -1in % Correct for LaTeX gratuitousness
\topmargin 4.5pc                % Nominal distance from top of page to top of
                                % box containing running head.
\advance\topmargin by -0.85in      % Correct for LaTeX gratuitousness
\headheight 0pt                 % Height of box containing running head.
\headsep 0pt                    % Space between running head and text.

\textheight 9in    
\textwidth 6.5in         % Width of text line.
                        % For two-column mode:
\columnwidth 3.125in
\columnsep 0.25in          %    Space between columns
\columnseprule 0pt      %    Width of rule between columns.
\hfuzz 1pt              % Allow some variation in column width, otherwise it's
                        % too hard to typeset in narrow columns.


\parskip 0pt plus 1pt            % Extra vertical space between paragraphs.
\lineskip 0pt
\normallineskip 0pt
\def\baselinestretch{1}

% \gdef\numberofauthors#1{\global\aucount=#1

\hyphenation{trace-route}
\hyphenation{Pla-net-Lab}

\widowpenalty=4000
\clubpenalty=4000

%\urlstyle{rm}

\renewcommand\section{\@startsection {section}{1}{\z@}%
  {-1.5ex \@plus -1ex \@minus -.2ex}%
  {1.0ex \@plus.4ex}%
  {\normalfont\Large\bfseries}}

\renewcommand\subsection{\@startsection{subsection}{2}{\z@}%
  {-1.25ex\@plus -1ex \@minus -.2ex}%
  {1.0ex \@plus .4ex}%
  {\normalfont\large\bfseries}}

\renewcommand\subsubsection{\@startsection{subsubsection}{3}{\z@}%
  {-1.25ex\@plus -1ex \@minus -.2ex}%
  {1.0ex \@plus .4ex}%
  {\normalfont\normalsize\bfseries}}


\def\abstract{%
    \if@twocolumn
%!PN      \small\it Abstract\/\bf---$\!$%
         \small{\itshape Abstract}\/\bfseries---$\!$%
    \else
%PN      \begin{center}\vspace{-0.8em}\small\bf Abstract\end{center}\quotation\small
      \begin{center}\vspace{-0.8em}\small\bfseries Abstract\end{center}\quotation\small
    \fi}
\def\endabstract{\vspace{0.6em}\par\if@twocolumn\else\endquotation\fi
%PN    \normalsize\rm}
    \normalsize\rmfamily}

%%%% bibliography spacing hack addition --- Michael Piatek 4/24/06
\makeatletter
\renewenvironment{thebibliography}[1]
     {\section*{\refname
        \@mkboth{\MakeUppercase\refname}{\MakeUppercase\refname}}%
      \list{\@biblabel{\@arabic\c@enumiv}}%
           {\settowidth\labelwidth{\@biblabel{#1}}%
            \itemsep 0em%
            \parsep 0em%
            \leftmargin\labelwidth
            \advance\leftmargin\labelsep
            \@openbib@code
            \usecounter{enumiv}%
            \let\p@enumiv\@empty
            \renewcommand\theenumiv{\@arabic\c@enumiv}}%
      \sloppy
      \clubpenalty4000
      \@clubpenalty \clubpenalty
      \widowpenalty4000%
      \sfcode`\.\@m}
     {\def\@noitemerr
       {\@latex@warning{Empty `thebibliography' environment}}%
      \endlist}
\makeatother 
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
