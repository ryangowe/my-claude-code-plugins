<!--
模板:完整设计文档(design doc)。较大子系统 / 架构 / 多处权衡。对应 spec/ 里的 architecture、review-ui、http-and-ui。
来源:「Design Docs at Google」(Malte Ubl, industrialempathy.com/posts/design-docs-at-google/)。
该文是论述、非填空模板,以下英文骨架忠实其描述的结构与指引,逐字保留指引措辞,不预先翻译。

使用时(由 create-spec 执行):
  1. 落盘到 spec/<今天日期>-<主题>.md
  2. 把下面英文正文翻译成中文,并套用 lotra 约定:
     - Non-Goals 可并入末尾的 `## 不在本次范围`(二选一,别重复)
     - Open Questions → `## 待定`
  3. 删掉本注释
-->

# {Title}

## Context and Scope

A brief overview of the technical landscape and what's being built, with objective background facts. Bring readers up to speed without requiring deep prior knowledge; they should be able to understand the problem space quickly.

## Goals and Non-Goals

**Goals**

- What the system aims to achieve.

**Non-Goals**

- Reasonable objectives that are deliberately excluded (e.g. "not ACID compliant"). Non-goals are often more decision-shaping than the goals themselves.

## The Actual Design

Start with an overview, then go into details. Emphasize the trade-offs made during design decisions — this is the place to write down the trade-offs, and what gives the document lasting value. May include a system-context diagram, API sketches, the data-storage approach, and pseudo-code for novel algorithms. Avoid verbatim schema definitions and large blocks of code; focus on the aspects relevant to the design and its trade-offs.

## Alternatives Considered

Alternative designs, each with its respective trade-offs and the reason it was rejected. This explicitly demonstrates why the chosen solution best serves the goals, and addresses the "why not X?" the reader is wondering about.

## Cross-Cutting Concerns

Sections addressing security, privacy, observability, and other organizational standards relevant to the design. These reviews happen early, when changes are still inexpensive. Drop the concerns that don't apply.

## Open Questions

Decisions not yet made. Be honest — leaving a question open beats pretending it is settled.
