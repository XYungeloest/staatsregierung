import { formatDate, toDisplayText } from '@ostrecht/shared/lib/norms/presentation.ts';
import type { NormDiffBlock, NormProvisionDiff } from '@ostrecht/shared/lib/norms/diff.ts';

type DiffSide = 'before' | 'after';

function escapeHtml(value: string | number | undefined): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function display(value: string | undefined): string {
  return toDisplayText(value ?? '');
}

function orderedChildren(nodes: NormDiffBlock[], side: DiffSide): NormDiffBlock[] {
  return nodes
    .slice()
    .sort((left, right) => {
      const leftIndex = side === 'before'
        ? left.beforeIndex ?? left.afterIndex ?? Number.POSITIVE_INFINITY
        : left.afterIndex ?? left.beforeIndex ?? Number.POSITIVE_INFINITY;
      const rightIndex = side === 'before'
        ? right.beforeIndex ?? right.afterIndex ?? Number.POSITIVE_INFINITY
        : right.afterIndex ?? right.beforeIndex ?? Number.POSITIVE_INFINITY;
      return leftIndex - rightIndex;
    });
}

function renderChunks(
  chunks: Array<{ kind: 'same' | 'insert' | 'delete'; text: string }> | undefined,
  side: DiffSide,
  fallback: string,
  markFallback: boolean,
): string {
  if (!chunks) {
    const text = escapeHtml(display(fallback));
    if (!markFallback || !text) return text;
    return side === 'before' ? `<del>${text}</del>` : `<ins>${text}</ins>`;
  }

  return chunks
    .filter((chunk) => chunk.kind === 'same' || (side === 'before' ? chunk.kind === 'delete' : chunk.kind === 'insert'))
    .map((chunk) => {
      const text = escapeHtml(display(chunk.text));
      if (chunk.kind === 'delete') return `<del>${text}</del>`;
      if (chunk.kind === 'insert') return `<ins>${text}</ins>`;
      return text;
    })
    .join('');
}

function renderValue(
  node: NormDiffBlock,
  side: DiffSide,
  field: 'label' | 'title' | 'text',
): string {
  const value = side === 'before' ? node.before : node.after;
  if (!value) return '';
  const fallback = value[field];
  if (!fallback) return '';
  const chunks = field === 'label' ? node.labelDiff : field === 'title' ? node.titleDiff : node.textDiff;
  const ownFieldChanged = node.before && node.after && (() => {
    const beforeField = node.before?.[field] ?? '';
    const afterField = node.after?.[field] ?? '';
    return field === 'text'
      ? beforeField.replace(/\s+/gu, ' ').trim() !== afterField.replace(/\s+/gu, ' ').trim()
      : beforeField !== afterField;
  })();
  const markFallback = node.kind === 'added' || node.kind === 'removed' || ownFieldChanged === true;
  return renderChunks(chunks, side, fallback, markFallback);
}

function headingTag(level: number): string {
  return `h${Math.min(Math.max(level, 3), 6)}`;
}

function renderHeading(node: NormDiffBlock, side: DiffSide, level: number, className: string): string {
  const Tag = headingTag(level);
  const label = renderValue(node, side, 'label');
  const title = renderValue(node, side, 'title');
  return `<${Tag} class="${className}">${label ? `<span class="norm-label">${label}</span> ` : ''}${title ? `<span class="norm-title">${title}</span>` : ''}</${Tag}>`;
}

function renderRuns(nodes: NormDiffBlock[], side: DiffSide, level: number, quoted: boolean): string {
  const output: string[] = [];
  const ordered = orderedChildren(nodes, side);
  let index = 0;
  while (index < ordered.length) {
    const node = ordered[index];
    if (node.type === 'item' || node.type === 'subitem') {
      const list: NormDiffBlock[] = [];
      while (index < ordered.length && (ordered[index].type === 'item' || ordered[index].type === 'subitem')) {
        list.push(ordered[index]);
        index += 1;
      }
      output.push(renderList(list, side, level, quoted));
      continue;
    }
    output.push(renderNode(node, side, level, quoted));
    index += 1;
  }
  return output.join('');
}

function renderList(nodes: NormDiffBlock[], side: DiffSide, level: number, quoted: boolean): string {
  const items = nodes.map((node) => {
    const label = renderValue(node, side, 'label');
    const text = renderValue(node, side, 'text');
    const children = renderRuns(node.children, side, level, quoted);
    return `<li class="norm-amendment-item norm-diff-structure__list-item"><span class="norm-amendment-item__label">${label}</span> <div class="norm-amendment-item__content"><span>${text}</span>${children ? `<div class="norm-amendment-item__children">${children}</div>` : ''}</div></li>`;
  }).join('');
  return `<ol class="norm-amendment-list${quoted ? ' norm-amendment-list--quoted' : ''}">${items}</ol>`;
}

function renderTable(node: NormDiffBlock, side: DiffSide): string {
  const value = side === 'before' ? node.before : node.after;
  if (!value) return '';
  const rows = orderedChildren(node.children, side)
    .filter((row) => (side === 'before' ? row.before : row.after)?.type === 'tableRow')
    .map((row) => {
      const cells = orderedChildren(row.children, side)
        .filter((cell) => (side === 'before' ? cell.before : cell.after)?.type === 'tableCell' || (side === 'before' ? cell.before : cell.after)?.type === 'tableHeaderCell')
        .map((cell) => {
          const cellValue = side === 'before' ? cell.before : cell.after;
          if (!cellValue) return '';
          const tag = cellValue.type === 'tableHeaderCell' ? 'th' : 'td';
          const scope = cellValue.scope ? ` scope="${escapeHtml(cellValue.scope)}"` : '';
          const rowspan = cellValue.rowspan ? ` rowspan="${cellValue.rowspan}"` : '';
          const colspan = cellValue.colspan ? ` colspan="${cellValue.colspan}"` : '';
          const text = renderValue(cell, side, 'text');
          const children = renderRuns(cell.children, side, 6, false);
          return `<${tag}${scope}${rowspan}${colspan}>${text}${children}</${tag}>`;
        }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
  return `<div class="table-wrap norm-table-wrap norm-diff-structure__table" tabindex="0" role="region" aria-label="${escapeHtml(value.title || 'Tabelle im Normtext')}"><table class="norm-table"><caption class="visually-hidden">${escapeHtml(value.title || 'Tabelle im Normtext')}</caption><tbody>${rows}</tbody></table></div>`;
}

function renderNode(node: NormDiffBlock, side: DiffSide, level: number, quoted: boolean): string {
  const value = side === 'before' ? node.before : node.after;
  if (!value) return '';
  const children = renderRuns(node.children, side, level + 1, quoted || node.type === 'quotedProvision');

  if (node.type === 'part' || node.type === 'chapter' || node.type === 'section' || node.type === 'subsection' || node.type === 'annex') {
    return `<section class="norm-division norm-diff-structure__division norm-division--${node.type}"><header class="norm-division__header">${renderHeading(node, side, level, 'norm-division__heading')}</header>${children}</section>`;
  }

  if (node.type === 'paragraph' || node.type === 'article') {
    const text = renderValue(node, side, 'text');
    return `<section class="norm-diff-structure__provision norm-${node.type}"><header class="norm-diff-structure__provision-header">${renderHeading(node, side, level, 'norm-diff-structure__provision-heading')}</header>${text ? `<p class="norm-text">${text}</p>` : ''}${children}</section>`;
  }

  if (node.type === 'paragraphText') {
    const label = renderValue(node, side, 'label');
    // Leerzeichen zwischen Label und Text wie in NormBody.astro (kopierbarer, vorlesbarer Text).
    return `<p class="norm-text">${label ? `<span class="norm-text__label">${label}</span> ` : ''}${renderValue(node, side, 'text')}</p>${children ? `<div class="norm-text__children">${children}</div>` : ''}`;
  }

  if (node.type === 'subparagraph') {
    const label = renderValue(node, side, 'label');
    return `<div class="norm-subparagraph-wrap"><p class="norm-subparagraph">${label ? `<span class="norm-subparagraph__label">${label}</span> ` : ''}<span>${renderValue(node, side, 'text')}</span></p>${children ? `<div class="norm-subparagraph__children">${children}</div>` : ''}</div>`;
  }

  if (node.type === 'table') return renderTable(node, side);
  if (node.type === 'quotedProvision') return `<blockquote class="norm-quoted-provision">${children}</blockquote>`;
  if (node.type === 'tableRow' || node.type === 'tableCell' || node.type === 'tableHeaderCell') {
    return `${renderValue(node, side, 'text')}${children}`;
  }
  return `${renderValue(node, side, 'text')}${children}`;
}

function renderSide(provision: NormProvisionDiff, side: DiffSide, date: string): string {
  const node: NormDiffBlock = {
    key: provision.key,
    type: provision.type,
    kind: provision.kind,
    ...(provision.before ? { before: provision.before } : {}),
    ...(provision.after ? { after: provision.after } : {}),
    children: provision.children,
    ...(provision.beforeText ? { beforeText: provision.beforeText } : {}),
    ...(provision.afterText ? { afterText: provision.afterText } : {}),
    ...(provision.titleDiff ? { titleDiff: provision.titleDiff } : {}),
    ...(provision.labelDiff ? { labelDiff: provision.labelDiff } : {}),
    ...(provision.textDiff ? { textDiff: provision.textDiff } : {}),
  };
  return `<section class="norm-diff__side norm-diff__side--${side}"><h3>Fassung vom ${escapeHtml(formatDate(date))}</h3><div class="norm-diff-structure">${renderNode(node, side, 3, false)}</div></section>`;
}

function statusLabel(kind: NormProvisionDiff['kind']): string {
  return kind === 'added' ? 'Neu' : kind === 'removed' ? 'Entfallen' : 'Geändert';
}

export function renderNormDiffDocument(
  provisions: NormProvisionDiff[],
  fromDate: string,
  toDate: string,
): string {
  const count = provisions.length;
  const provisionMarkup = provisions.map((provision) => {
    const before = provision.before ? renderSide(provision, 'before', fromDate) : '';
    const after = provision.after ? renderSide(provision, 'after', toDate) : '';
    return `<li class="norm-diff__provision norm-diff__provision--${provision.kind}"><span class="norm-diff__status">${statusLabel(provision.kind)}</span><div class="norm-diff__provision-columns">${before}${after}</div></li>`;
  }).join('');
  return `<header class="norm-diff__header"><h2><time datetime="${escapeHtml(fromDate)}">${escapeHtml(formatDate(fromDate))}</time><span aria-hidden="true"> → </span><span class="visually-hidden">verglichen mit </span><time datetime="${escapeHtml(toDate)}">${escapeHtml(formatDate(toDate))}</time></h2><p>${count} geänderte ${count === 1 ? 'Vorschrift' : 'Vorschriften'}</p></header><ol class="norm-diff__list">${provisionMarkup}</ol>${count === 0 ? '<p>Zwischen diesen Fassungen wurden keine Textänderungen erkannt.</p>' : ''}`;
}
