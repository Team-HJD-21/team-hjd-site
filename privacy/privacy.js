// No tracking, backend, email sending or storage. Consent is recorded only if
// the visitor sends the prepared message using their own mail application.
const collection = document.querySelector('#collection-consent');
const transfer = document.querySelector('#transfer-consent');
const compose = document.querySelector('#compose-email');
const status = document.querySelector('#consent-status');
function updateConsent() {
  const ready = collection.checked && transfer.checked;
  compose.setAttribute('aria-disabled', String(!ready));
  compose.tabIndex = ready ? 0 : -1;
  if (ready) {
    const body = [
      '[TeamHJD 개인정보 안내 / Privacy notice v1.0 — 2026-10-04]',
      'https://teamhjd.com/privacy/',
      '일반 문의의 개인정보 수집·이용에 동의합니다. / I agree to collection and use for my general enquiry.',
      'Google Workspace를 통한 개인정보 국외 처리·보관에 별도로 동의합니다. / I separately agree to international processing and storage through Google Workspace.',
      '', '문의 내용 / Enquiry:', '',
    ].join('\r\n');
    compose.href = `mailto:support@teamhjd.com?subject=${encodeURIComponent('TeamHJD 문의 / Enquiry')}&body=${encodeURIComponent(body)}`;
    status.textContent = '메일 앱에서 내용을 작성한 뒤 직접 전송해 주세요. 작성창을 여는 것만으로 문의가 접수되지는 않습니다.';
  } else {
    compose.removeAttribute('href');
    status.textContent = '두 동의를 선택하면 메일 작성창을 열 수 있습니다.';
  }
}
collection.addEventListener('change', updateConsent);
transfer.addEventListener('change', updateConsent);
compose.addEventListener('click', event => {
  if (!collection.checked || !transfer.checked) event.preventDefault();
});
// Reset on load/Back navigation: never infer consent from a previous visit.
window.addEventListener('pageshow', () => {
  collection.checked = false;
  transfer.checked = false;
  updateConsent();
});
updateConsent();
