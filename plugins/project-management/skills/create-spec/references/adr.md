<!--
模板:架构决策记录(ADR)。记录单个有分量的设计决策 + 理由,一事一记。
来源:MADR 模板(github.com/adr/madr/blob/main/template/adr-template.md)。
以下英文正文逐字保留,不预先翻译——翻译错误写进模板会被反复复用,代价大于临用翻译。

使用时(由 create-spec 执行):
  1. 落盘到 spec/<今天日期>-<主题>.md(本项目 ADR 与 spec 同目录、同命名)
  2. 把下面英文正文翻译成中文;被取代时不改旧记录,新开一条、status 标 superseded by <文件>
  3. 删掉本注释
-->

______________________________________________________________________

## status: "{proposed | rejected | accepted | deprecated | … | superseded by ADR-0123}" date: {YYYY-MM-DD when the decision was last updated} decision-makers: {list everyone involved in the decision} consulted: {list everyone whose opinions are sought (typically subject-matter experts); and with whom there is a two-way communication} informed: {list everyone who is kept up-to-date on progress; and with whom there is a one-way communication}

# {short title, representative of solved problem and found solution}

## Context and Problem Statement

{Describe the context and problem statement, e.g., in free form using two to three sentences or in the form of an illustrative story. You may want to articulate the problem in form of a question. Consider adding links to collaboration boards or issue management systems. Make the scope of the decision explicit, for instance, by calling out or pointing at structural architecture elements (components, connectors, ...).}

<!-- This is an optional element. Feel free to remove. -->

## Decision Drivers

- {decision driver 1, for instance, a desired software quality, faced concern, constraint or force}
- {decision driver 2}
- …

## Considered Options

- {title of option 1}
- {title of option 2}
- {title of option 3}
- …

## Decision Outcome

Chosen option: "{title of option 1}", because {justification. e.g., only option, which meets k.o. criterion decision driver | which resolves force {force} | … | comes out best (see below)}.

<!-- This is an optional element. Feel free to remove. -->

### Consequences

- Good, because {positive consequence, e.g., improvement of one or more desired qualities, …}
- Bad, because {negative consequence, e.g., compromising one or more desired qualities, …}
- …

<!-- This is an optional element. Feel free to remove. -->

### Confirmation

{Describe how the implementation / compliance of the ADR can/will be confirmed. Is there any automated or manual fitness function? If so, list it and explain how it is applied. Is the chosen design and its implementation in line with the decision? E.g., a design/code review or a test with a library such as ArchUnit can help validate this. Note that although we classify this element as optional, it is included in many ADRs.}

## Pros and Cons of the Options

### {title of option 1}

<!-- This is an optional element. Feel free to remove. -->

{example | description | pointer to more information | …}

- Good, because {argument a}
- Good, because {argument b}
- Neutral, because {argument c}
- Bad, because {argument d}
- …

### {title of other option}

{example | description | pointer to more information | …}

- Good, because {argument a}
- Neutral, because {argument b}
- Bad, because {argument c}
- …

<!-- This is an optional element. Feel free to remove. -->

## More Information

{You might want to provide additional evidence/confidence for the decision outcome here and/or document the team agreement on the decision and/or define when/how this decision the decision should be realized and if/when it should be re-visited. Links to other decisions and resources might appear here as well.}
