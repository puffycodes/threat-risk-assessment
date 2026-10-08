# Features for Assessment Browser

## Purpose

- Allow a user to browse the threat risk assessment and other related information on a web browser.

## Requirement

- Show every subject: each folder under scenario/ or output/
    - For each subject, show the TRA version and status, the number of risks at each rating, and the number of open questions
- For each subject, show an overview:
    - The number of risks at each rating, before and after treatment
    - A risk matrix of likelihood against impact, before or after treatment, using the bands in the TRA's own risk matrix
    - The risk register, which can be sorted and filtered
    - The list of documents, with their version, status, date and when the file last changed
- Show the clarification questions, filtered by status
    - Show questions that have an answer but are still Open as answered but not yet assessed
- Show each document rendered from its Markdown, with a table of contents
    - Also show the Markdown source with line numbers
    - For a system summary, link to its other versions
- Link every ID (such as R-, A-, Q-, SC-, DD-) to where it is defined, even in another document
    - Show the definition when the user hovers over the ID
    - Link file references, such as file.md:52, to that line of the file
- Search across all the documents of a subject
- Update the page when a document changes on disk
- Work on a phone-sized screen, in light and dark themes
- The documents can describe real systems, so:
    - Only read files; never change them
    - Only serve the .md files under scenario/ and output/
    - Only accept connections from the same machine
    - Load nothing from the Internet
    - Never run anything written in a document as code in the page

## Contraint

- Should not need to invoke any agents or skills.
