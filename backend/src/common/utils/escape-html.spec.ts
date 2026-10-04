import { escapeHtml } from './escape-html';

describe('escapeHtml', () => {
  it('escapes every character that is special in HTML', () => {
    expect(escapeHtml(`<a href="x" title='y'>Tom & Jerry</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;Tom &amp; Jerry&lt;/a&gt;',
    );
  });

  it('neutralises markup a user might type into a form', () => {
    const typed = '"><script>alert(1)</script>';
    expect(escapeHtml(typed)).toBe('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escapeHtml(typed)).not.toMatch(/[<>"]/);
  });

  it('escapes existing entities again instead of trusting them', () => {
    expect(escapeHtml('&lt;b&gt;')).toBe('&amp;lt;b&amp;gt;');
  });

  it('leaves ordinary text alone', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml('ada.lovelace+todo@example.com')).toBe('ada.lovelace+todo@example.com');
    expect(escapeHtml('Café → naïve 日本')).toBe('Café → naïve 日本');
  });
});
