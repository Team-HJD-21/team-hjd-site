// No tracking, backend, email sending or storage. Consent is recorded only if
// the visitor sends the prepared message using their own mail application.
const collection = document.querySelector('#collection-consent');
const transfer = document.querySelector('#transfer-consent');
const compose = document.querySelector('#compose-email');
const status = document.querySelector('#consent-status');
const requestType = new URL(location.href).searchParams.get('type');
const requestLang = new URL(location.href).searchParams.get('lang');
const bugTemplates = {
  ko: ['게임 버전:', '운영체제 및 버전:', '재현 순서:', '기대한 결과:', '실제 결과:', '발생 빈도:', '관련 스크린샷: (이메일·계정 정보를 가린 뒤 메일 앱에서 첨부)', '비밀번호·결제 정보 등 불필요한 개인정보는 보내지 마세요.'],
  en: ['Game version:', 'Operating system and version:', 'Steps to reproduce:', 'Expected result:', 'Actual result:', 'How often it occurs:', 'Screenshots: (hide email/account details, then attach in your email app)', 'Do not include passwords, payment details, or unnecessary personal data.'],
  'zh-CN': ['游戏版本：', '操作系统与版本：', '复现步骤：', '预期结果：', '实际结果：', '发生频率：', '相关截图：（遮盖邮箱和账号信息后，在邮件应用中添加附件）', '请勿发送密码、支付信息或不必要的个人信息。'],
};
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
      '', ...(requestType === 'bug' ? (Object.hasOwn(bugTemplates, requestLang) ? bugTemplates[requestLang] : bugTemplates.ko) : requestType === 'press' ? ['매체/채널 · Outlet/channel:', '사용 목적 · Intended use:', '사용할 자료 · Requested materials:', '게시 예정 URL · Planned publication URL (optional):', '문의 내용 · Enquiry:', ''] : ['문의 내용 / Enquiry:', '']),
    ].join('\r\n');
    const subject = requestType === 'bug' ? 'The Developer 버그 제보 / Bug report' : requestType === 'press' ? 'TeamHJD 프레스 문의 / Press enquiry' : 'TeamHJD 문의 / Enquiry';
    compose.href = `mailto:support@teamhjd.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
