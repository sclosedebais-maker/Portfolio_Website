/* ============================================================================
   AIVA — format.js
   Number and text formatting shared by the interface, the charts and the
   exported documents. Executive reports round hard: no cents, no false
   precision, and a currency that matches the case.
   ============================================================================ */

window.AIVA = window.AIVA || {};

(function (AIVA) {
  'use strict';

  const LOCALE = 'en-AU';
  let currency = 'AUD';
  const setCurrency = (c) => { currency = c || 'AUD'; };

  const money = (v, opts) => {
    const o = opts || {};
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency', currency,
      maximumFractionDigits: o.decimals || 0, minimumFractionDigits: o.decimals || 0
    }).format(Number.isFinite(+v) ? +v : 0);
  };

  const symbol = () => {
    const parts = new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).formatToParts(1);
    const s = parts.find((p) => p.type === 'currency');
    return s ? s.value : '$';
  };

  const moneyShort = (v) => {
    const value = Number.isFinite(+v) ? +v : 0;
    const sign = value < 0 ? '-' : '';
    const a = Math.abs(value);
    const sym = symbol();
    if (a >= 1e9) return sign + sym + (a / 1e9).toFixed(a >= 1e10 ? 0 : 2) + 'B';
    if (a >= 1e6) return sign + sym + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M';
    if (a >= 1e4) return sign + sym + Math.round(a / 1e3) + 'k';
    if (a >= 1e3) return sign + sym + (a / 1e3).toFixed(1) + 'k';
    return sign + sym + Math.round(a);
  };

  const number = (v, decimals) => new Intl.NumberFormat(LOCALE, {
    maximumFractionDigits: decimals === undefined ? 0 : decimals,
    minimumFractionDigits: decimals === undefined ? 0 : decimals
  }).format(Number.isFinite(+v) ? +v : 0);

  const percent = (v, decimals) => number(v, decimals === undefined ? 0 : decimals) + '%';

  const months = (v) => {
    if (v === null || v === undefined || !Number.isFinite(+v)) return 'Not within horizon';
    const m = +v;
    if (m < 1) return 'Under 1 month';
    if (m < 12) return (Math.round(m * 10) / 10) + (Math.round(m * 10) / 10 === 1 ? ' month' : ' months');
    const years = Math.floor(m / 12);
    const rem = Math.round(m - years * 12);
    return years + (years === 1 ? ' yr ' : ' yrs ') + rem + (rem === 1 ? ' mo' : ' mos');
  };

  const band = (score) => {
    if (score >= 75) return { label: 'Strong', tone: 'good' };
    if (score >= 60) return { label: 'Sound', tone: 'good' };
    if (score >= 45) return { label: 'Moderate', tone: 'warn' };
    if (score >= 30) return { label: 'Weak', tone: 'serious' };
    return { label: 'Poor', tone: 'serious' };
  };

  const complexityBand = (fitScore) => {
    // Higher agentic fit generally means a more complex workflow to automate.
    if (fitScore >= 78) return 'High';
    if (fitScore >= 55) return 'Medium';
    return 'Low';
  };

  const today = () => new Date().toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });

  const escapeHtml = (s) => String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const paragraphs = (text) => String(text || '').trim().split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  AIVA.fmt = { setCurrency, money, moneyShort, number, percent, months, band, complexityBand, today, escapeHtml, paragraphs, symbol };
})(window.AIVA);
