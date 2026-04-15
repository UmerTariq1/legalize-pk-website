We built legalize-pk to make it easier to understand how the Pakistani Constitution has evolved over time. By breaking down the text into individual articles and tracking changes through Git commits, we can see exactly what was amended, when, and how it fits into the overall structure of the constitution.

Now this legalize-pk-website is the website interface for legalize-pk. Allowing the general public to easily navigate the history of constitutional amendments without needing to use Git commands. It provides a user-friendly way to explore the changes in the constitution, see the text of each article as it stood at different points in time, and understand the context of each amendment.



## Legalize-pk: A Git Repository of the Pakistani Constitution's Amendments


### The idea behind
Most people encounter the constitution as a single long document or scattered PDFs. That makes it difficult to see what changed, when, and in which part of the text.

This repository splits the 1973 Constitution into individual Markdown files - one per article - and records each enacted amendment as a backdated Git commit that updates only the articles it actually changed. The result is a history you can navigate with standard Git tools:

Each commit is backdated to the amendment's actual date of assent, so the repository's history mirrors constitutional time rather than the order files were created.

The repository covers all 24 enacted amendments from 1974 through 2025 (the 9th, 11th, and 15th were proposed but never passed). The most recent is the 27th Amendment of November 2025.

### What git commands could do on legalize-pk:
#### See every amendment that touched Article 239
git log -- federal-constitution/article-239.md

#### Compare the article's text before and after the 18th Amendment
git diff <commit-hash-before> <commit-hash-after> -- federal-constitution/article-239.md

#### Read the full article as it stood on a given date
git show <commit-hash>:federal-constitution/article-239.md

#### See all amendments by a specific president
git log --author="Fazal Ilahi Chaudhry" --oneline --date=short --format="%ad %s"

#### See what files changed in a specific amendment
git show --stat <commit-hash>

#### List all amendments in order with dates
git log --oneline --format="%ad %s" --date=short

> To find commit hashes, run git log --oneline. Each line starts with a short hash you can use in the commands above.
>
>To list all presidents who signed amendments: git log --format="%an" | sort -u 
>
> Want to know what Article 63 said before the 18th Amendment? Now its One-line git diff.

### For website development and LLMs

The website uses two precomputed, static data files:

- `data.json`: the amendment timeline and article change index built from the Git history
- `data/current-constitution.json`: one JSON object per markdown file in `data/federal-constitution`, including sub-articles and `preamble.md`

The constitution text dataset is generated directly from the markdown files, so the current text stays aligned with the source files without needing Git parsing at runtime.

**For detailed schema documentation and usage patterns, see [technical-data.md](technical-data.md).**

This guide explains:
- The structure of commits and articles
- The structure of the current constitution text dataset
- How to query for timelines, amendment details, and change history
- Common feature patterns with JavaScript examples
- File location and canonical data source guidance

If you're building new website features or using this data in AI/LLM workflows, start there. 


