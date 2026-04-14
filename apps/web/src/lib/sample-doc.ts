export const SAMPLE_LATEX = `\\documentclass[12pt]{article}

\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{geometry}

\\geometry{a4paper, margin=1in}

\\title{Introduction to LaTeX}
\\author{Your Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{abstract}
This document demonstrates the basic features of \\LaTeX{} typesetting.
It covers sections, mathematics, figures, and references.
\\end{abstract}

\\tableofcontents

\\section{Introduction}

\\LaTeX{} is a document preparation system for high-quality typesetting.
It is widely used in academia for the communication and publication of
scientific documents in many fields, including mathematics, computer
science, engineering, physics, and economics.

\\subsection{Why LaTeX?}

\\LaTeX{} provides several advantages over word processors:

\\begin{itemize}
  \\item Professional-quality typesetting
  \\item Excellent handling of mathematical notation
  \\item Automatic numbering and cross-referencing
  \\item Separation of content from formatting
\\end{itemize}

\\section{Mathematics}

One of \\LaTeX{}'s greatest strengths is typesetting mathematics.

\\subsection{Inline Mathematics}

Einstein's famous equation \\( E = mc^2 \\) changed physics forever.
The quadratic formula is \\( x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} \\).

\\subsection{Display Mathematics}

The Euler identity:
\\[
  e^{i\\pi} + 1 = 0
\\]

A more complex equation:
\\begin{equation}
  \\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}
  \\label{eq:gaussian}
\\end{equation}

See Equation~\\ref{eq:gaussian} for the Gaussian integral.

\\section{Lists and Environments}

\\subsection{Enumerated List}

\\begin{enumerate}
  \\item First item
  \\item Second item
  \\item Third item with nested list:
    \\begin{enumerate}
      \\item Sub-item A
      \\item Sub-item B
    \\end{enumerate}
\\end{enumerate}

\\subsection{Tables}

\\begin{table}[h]
  \\centering
  \\begin{tabular}{|l|c|r|}
    \\hline
    \\textbf{Left} & \\textbf{Center} & \\textbf{Right} \\\\
    \\hline
    Alpha & 1 & 0.001 \\\\
    Beta  & 2 & 0.002 \\\\
    Gamma & 3 & 0.003 \\\\
    \\hline
  \\end{tabular}
  \\caption{A sample table.}
  \\label{tab:sample}
\\end{table}

\\section{Conclusion}

\\LaTeX{} is a powerful tool for creating professional documents.
This template can serve as a starting point for your own work.

\\end{document}
`;

export const SAMPLE_BIB = `@article{knuth1984,
  author  = {Donald E. Knuth},
  title   = {Literate Programming},
  journal = {The Computer Journal},
  volume  = {27},
  number  = {2},
  pages   = {97--111},
  year    = {1984},
}

@book{lamport1994,
  author    = {Leslie Lamport},
  title     = {\\LaTeX: A Document Preparation System},
  publisher = {Addison-Wesley},
  year      = {1994},
  edition   = {2nd},
}
`;

export const SAMPLE_FILES: Record<string, { content: string; type: 'tex' | 'bib' }> = {
  'main.tex': { content: SAMPLE_LATEX, type: 'tex' },
  'references.bib': { content: SAMPLE_BIB, type: 'bib' },
};
