export const EMAIL_BRAND_NAME = 'Data Mahder';
export const EMAIL_BRAND_SUBTITLE =
  'Opensource and Community-powered data platform for low-resource languages!';

export interface EmailAction {
  label: string;
  url: string;
}

export interface EmailHighlight {
  label: string;
  value: string;
}

export interface EmailTemplateData {
  preheader: string;
  greeting?: string;
  paragraphs: string[];
  highlight?: EmailHighlight;
  action?: EmailAction;
  note?: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entities[character];
  });
}

export function renderEmail(data: EmailTemplateData): RenderedEmail {
  const greeting = data.greeting
    ? `<p style="margin:0 0 20px;color:#243b53;font-size:16px;line-height:1.6">${escapeHtml(data.greeting)}</p>`
    : '';
  const paragraphs = data.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:#486581;font-size:15px;line-height:1.7">${escapeHtml(paragraph)}</p>`,
    )
    .join('');
  const highlight = data.highlight
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;background:#f0f7f8;border:1px solid #d5e9eb;border-radius:8px"><tr><td style="padding:18px 20px"><div style="color:#486581;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(data.highlight.label)}</div><div style="margin-top:8px;color:#102a43;font-size:24px;font-weight:700;letter-spacing:.12em;word-break:break-word">${escapeHtml(data.highlight.value)}</div></td></tr></table>`
    : '';
  const action = data.action
    ? `<p style="margin:26px 0 24px"><a href="${escapeHtml(data.action.url)}" style="display:inline-block;padding:13px 22px;background:#087e8b;border-radius:6px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">${escapeHtml(data.action.label)}</a></p><p style="margin:0 0 20px;color:#829ab1;font-size:12px;line-height:1.6">If the button does not work, copy and paste this link into your browser:<br><a href="${escapeHtml(data.action.url)}" style="color:#087e8b;word-break:break-all">${escapeHtml(data.action.url)}</a></p>`
    : '';
  const note = data.note
    ? `<p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #e5edf3;color:#829ab1;font-size:13px;line-height:1.6">${escapeHtml(data.note)}</p>`
    : '';
  const brandName = escapeHtml(EMAIL_BRAND_NAME);
  const brandSubtitle = escapeHtml(EMAIL_BRAND_SUBTITLE);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f7fa;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(data.preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fa"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e5edf3;border-radius:10px;overflow:hidden"><tr><td style="padding:22px 32px;background:#102a43"><div style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:.08em">${brandName}</div><div style="margin-top:8px;color:#bcccdc;font-size:12px;line-height:1.5">${brandSubtitle}</div></td></tr><tr><td style="padding:34px 32px 30px">${greeting}${paragraphs}${highlight}${action}${note}<p style="margin:28px 0 0;color:#486581;font-size:14px;line-height:1.6">Regards,<br><strong>The ${brandName} Team</strong></p></td></tr></table></td></tr></table></body></html>`;

  const textParts = [
    EMAIL_BRAND_NAME,
    EMAIL_BRAND_SUBTITLE,
    data.greeting,
    ...data.paragraphs,
    data.highlight
      ? `${data.highlight.label}: ${data.highlight.value}`
      : undefined,
    data.action ? `${data.action.label}: ${data.action.url}` : undefined,
    data.note,
    `Regards,\nThe ${EMAIL_BRAND_NAME} Team`,
  ].filter((part): part is string => Boolean(part));

  return { html, text: textParts.join('\n\n') };
}
