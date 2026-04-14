/**
 * Seed built-in project templates.
 * Run with: pnpm tsx packages/db/src/seed-templates.ts
 */

import { config } from 'dotenv';
config({ path: '.env' });

import { createDb } from './client.js';
import { projectTemplates } from './schema.js';

const db = createDb(process.env.DATABASE_URL!).db;

const templates = [
  {
    name: 'Article',
    description: 'Standard LaTeX article — good starting point for most papers.',
    category: 'article' as const,
    files: [
      {
        path: 'main.tex',
        content: `\\documentclass[12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb}
\\usepackage{hyperref}

\\title{Article Title}
\\author{Author Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{abstract}
Write your abstract here.
\\end{abstract}

\\section{Introduction}
Your introduction goes here.

\\section{Methods}

\\section{Results}

\\section{Conclusion}

\\bibliographystyle{plain}
\\bibliography{references}

\\end{document}
`,
      },
      {
        path: 'references.bib',
        content: `@article{example2024,
  author  = {Author, A.},
  title   = {Example Paper},
  journal = {Journal Name},
  year    = {2024},
  volume  = {1},
  pages   = {1--10},
}
`,
      },
    ],
  },
  {
    name: 'IEEE Conference Paper',
    description: 'IEEE two-column conference paper format.',
    category: 'ieee' as const,
    files: [
      {
        path: 'main.tex',
        content: `\\documentclass[conference]{IEEEtran}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{cite}

\\begin{document}

\\title{Paper Title}

\\author{\\IEEEauthorblockN{First Author}
\\IEEEauthorblockA{Department\\\\
Institution\\\\
email@example.com}}

\\maketitle

\\begin{abstract}
Your abstract here.
\\end{abstract}

\\begin{IEEEkeywords}
keyword1, keyword2, keyword3
\\end{IEEEkeywords}

\\section{Introduction}
Introduction text.

\\section{Methodology}

\\section{Results and Discussion}

\\section{Conclusion}

\\bibliographystyle{IEEEtran}
\\bibliography{references}

\\end{document}
`,
      },
      { path: 'references.bib', content: '' },
    ],
  },
  {
    name: 'Beamer Presentation',
    description: 'LaTeX Beamer presentation slides.',
    category: 'beamer' as const,
    files: [
      {
        path: 'main.tex',
        content: `\\documentclass{beamer}
\\usetheme{Madrid}
\\usecolortheme{beaver}

\\title{Presentation Title}
\\subtitle{Optional Subtitle}
\\author{Author Name}
\\institute{Institution}
\\date{\\today}

\\begin{document}

\\begin{frame}
  \\titlepage
\\end{frame}

\\begin{frame}{Outline}
  \\tableofcontents
\\end{frame}

\\section{Introduction}

\\begin{frame}{Introduction}
  \\begin{itemize}
    \\item First point
    \\item Second point
    \\item Third point
  \\end{itemize}
\\end{frame}

\\section{Main Content}

\\begin{frame}{A Frame with Two Columns}
  \\begin{columns}
    \\column{0.5\\textwidth}
    Left column content.
    \\column{0.5\\textwidth}
    Right column content.
  \\end{columns}
\\end{frame}

\\section{Conclusion}

\\begin{frame}{Conclusion}
  \\begin{itemize}
    \\item Summary point 1
    \\item Summary point 2
  \\end{itemize}
\\end{frame}

\\end{document}
`,
      },
    ],
  },
  {
    name: 'Thesis',
    description: 'Multi-chapter thesis structure with bibliography and appendix.',
    category: 'thesis' as const,
    files: [
      {
        path: 'main.tex',
        content: `\\documentclass[12pt,a4paper]{report}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{setspace}
\\doublespacing

\\begin{document}

\\begin{titlepage}
  \\centering
  {\\LARGE\\bfseries Thesis Title\\par}
  \\vspace{2cm}
  {\\large Author Name\\par}
  \\vfill
  Submitted in partial fulfilment of the requirements\\\\
  for the degree of Doctor of Philosophy\\\\[1cm]
  Department Name\\\\
  University Name\\\\[1cm]
  \\today
\\end{titlepage}

\\tableofcontents
\\listoffigures
\\listoftables

\\input{chapters/abstract}
\\input{chapters/introduction}
\\input{chapters/background}
\\input{chapters/methodology}
\\input{chapters/results}
\\input{chapters/conclusion}

\\bibliographystyle{plain}
\\bibliography{references}

\\appendix
\\chapter{Additional Data}

\\end{document}
`,
      },
      {
        path: 'chapters/abstract.tex',
        content: `\\chapter*{Abstract}
\\addcontentsline{toc}{chapter}{Abstract}
Write your abstract here.
`,
      },
      {
        path: 'chapters/introduction.tex',
        content: `\\chapter{Introduction}
\\label{ch:intro}

Write your introduction here.

\\section{Motivation}

\\section{Research Questions}

\\section{Thesis Structure}
`,
      },
      {
        path: 'chapters/background.tex',
        content: `\\chapter{Background}
\\label{ch:background}

Review related work here.
`,
      },
      {
        path: 'chapters/methodology.tex',
        content: `\\chapter{Methodology}
\\label{ch:methodology}

Describe your methodology here.
`,
      },
      {
        path: 'chapters/results.tex',
        content: `\\chapter{Results}
\\label{ch:results}

Present your results here.
`,
      },
      {
        path: 'chapters/conclusion.tex',
        content: `\\chapter{Conclusion}
\\label{ch:conclusion}

Conclude your thesis here.
`,
      },
      { path: 'references.bib', content: '' },
    ],
  },
  {
    name: 'Curriculum Vitae',
    description: 'Clean academic CV using the moderncv package.',
    category: 'cv' as const,
    files: [
      {
        path: 'main.tex',
        content: `\\documentclass[11pt,a4paper,sans]{moderncv}
\\moderncvstyle{banking}
\\moderncvcolor{blue}
\\usepackage[utf8]{inputenc}
\\usepackage[scale=0.85]{geometry}

\\name{First}{Last}
\\title{Curriculum Vitae}
\\address{123 Street}{City, Country}{}
\\phone[mobile]{+1 234 567 8900}
\\email{email@example.com}
\\homepage{yourwebsite.com}

\\begin{document}
\\makecvtitle

\\section{Education}
\\cventry{2020--2024}{PhD in Computer Science}{University Name}{City}{}{}
\\cventry{2016--2020}{BSc in Computer Science}{University Name}{City}{GPA: 4.0}{}

\\section{Experience}
\\cventry{2021--2024}{Research Assistant}{Lab Name}{University}{}{
  \\begin{itemize}
    \\item Achievement one
    \\item Achievement two
  \\end{itemize}
}

\\section{Publications}
\\cvitem{2023}{Author, A. \\textit{Paper Title}. Journal Name.}

\\section{Skills}
\\cvitem{Programming}{Python, C++, LaTeX}
\\cvitem{Languages}{English (native), Other (intermediate)}

\\end{document}
`,
      },
    ],
  },
];

async function seed() {
  console.log('Seeding templates...');
  for (const t of templates) {
    await db
      .insert(projectTemplates)
      .values({
        name: t.name,
        description: t.description,
        category: t.category,
        files: t.files,
        isBuiltin: true,
      })
      .onConflictDoNothing();
    console.log(`  ✓ ${t.name}`);
  }
  console.log('Done.');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
