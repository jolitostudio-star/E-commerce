import { parseListingRef, isShortListingLink } from './_listing.js';
import { readCookie, seal, unseal } from './_auth.js';

export function validateLead(input) {
  if (typeof input !== 'string') return null;
  const ref = input.trim();
  if (!ref || ref.length > 2000) return null;
  if (/^[A-Z]{3}-?\d{6,}$/i.test(ref)) return ref;
  try {
    const url = new URL(ref);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (!/^(?:[\w-]+\.)*mercadolivre\.com\.br$/.test(url.hostname) && !/^(?:[\w-]+\.)*mercadolibre\.com$/.test(url.hostname) && url.hostname !== 'meli.la') return null;
    return parseListingRef(ref) || isShortListingLink(ref) ? ref : null;
  } catch { return null; }
}

export function leadCookie(request, ref) {
  const secure = process.env.VERCEL || new URL(request.url).protocol === 'https:';
  return `miq_lead=${encodeURIComponent(seal({ ref, createdAt: Date.now() }))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure ? '; Secure' : ''}`;
}

export function readLead(request) {
  try {
    const lead = unseal(readCookie(request, 'miq_lead'));
    return lead && Date.now() - lead.createdAt < 604800000 ? validateLead(lead.ref) : null;
  } catch { return null; }
}

// Only the useful preview leaves the server; the full strategy remains private.
export function previewOf(analysis) {
  const titleScore = analysis.title?.score;
  const pictures = analysis.content?.pictures;
  let finding;
  if (Number.isFinite(titleScore) && titleScore < 80) {
    const check = analysis.title.checks?.find(entry => !entry.ok);
    finding = { area: 'Título', title: 'O título pode melhorar', detail: check?.detail || 'Revise a clareza e os termos que descrevem o produto.' };
  } else if (Number.isFinite(pictures) && pictures < 3) {
    finding = { area: 'Fotos', title: 'Poucas fotos para apresentar o produto', detail: `O anúncio tem ${pictures} foto(s). Mostre detalhes, medidas e usos do produto.` };
  } else {
    finding = { area: 'Título', title: 'Um bom ponto de partida', detail: 'O título atende aos critérios técnicos avaliados. Isso não garante vendas; preço, conteúdo e condições da oferta também importam.' };
  }
  return {
    listing: { id: analysis.listing.id, title: analysis.listing.title },
    titleScore: Number.isFinite(titleScore) ? titleScore : null,
    finding,
    analyzedAt: analysis.analyzedAt,
    note: 'A nota avalia critérios do título, não mede conversão nem prevê vendas.'
  };
}
