const shell = (title, body) => `<div class="reading-shell"><header class="article-header"><h1>${title}</h1></header><div class="prose">${body}</div></div>`;
export const subscriptionPages = {
 confirm: {title:'이메일 확인',content:shell('구독을 시작할까요?', '<p>아래 버튼을 누르면 이메일 주소 확인이 완료됩니다. 확인 링크는 24시간 동안 유효합니다.</p><form data-subscription-action="confirm"><button class="subscription-action" type="submit">이메일 확인하고 구독하기</button><p role="status" aria-live="polite" data-subscription-status></p></form><p><a href="/">첫 화면으로 돌아가기</a></p>')},
 unsubscribe: {title:'구독 해지',content:shell('구독을 해지할까요?', '<p>해지하시면 이메일 주소가 삭제되며, 이후 뉴스레터를 보내지 않습니다.</p><form data-subscription-action="unsubscribe"><button class="subscription-action" type="submit">구독 해지하기</button><p role="status" aria-live="polite" data-subscription-status></p></form><p><a href="/">첫 화면으로 돌아가기</a></p>')},
 privacy: {title:'구독 개인정보 안내',content:shell('구독 개인정보 안내', `
<p>겜붕이의 노트는 TeamHJD가 운영하는 게임 개발 뉴스레터입니다. 시행일·동의 버전은 2026년 11월 3일입니다. 문의는 <a href="mailto:Jdhwang@teamhjd.com">Jdhwang@teamhjd.com</a>으로 보내 주세요.</p>
<h2>어떤 정보를 왜 보관하나요?</h2><p>이메일 주소, 동의 항목·시각·버전, 구독 상태와 이메일 확인 시각을 수집합니다. 구독 인증, 매일 발행되는 게임 개발 글 안내, 구독 해지 처리에 사용합니다. 별도 광고나 구매 권유 메일에는 사용하지 않습니다.</p>
<h2>언제까지 보관하나요?</h2><p>구독 중인 이메일은 해지할 때까지 보관하고 해지 처리 시 삭제합니다. 인증하지 않은 신청 정보는 7일 후 삭제합니다. 삭제 처리는 서비스 요청 시 수행합니다. 중복 발송 방지를 위한 임의 식별자·발송 시각·처리 상태는 30일간 보관하며 이메일 주소는 포함하지 않습니다. 남용 방지를 위한 IP 기반 HMAC 값은 원본 IP를 저장하지 않고 최대 24시간 후 정리합니다. 서비스 제공자의 보안 로그·백업은 각 제공자의 보존 정책에 따라 별도로 삭제됩니다.</p>
<h2>동의를 거부해도 괜찮나요?</h2><p>동의하지 않으시면 이메일 구독을 제공하기 어렵습니다. 사이트에서 글을 읽는 데에는 영향이 없습니다. 메일 하단의 해지 링크로 동의를 철회하실 수 있으며, 정보 열람·정정·삭제도 운영자에게 요청하실 수 있습니다. 체크박스는 미리 선택하지 않습니다. 이메일의 확인 버튼을 누르기 전에는 구독을 활성화하지 않습니다.</p>
<h2 id="overseas">국외 처리와 업무 위탁</h2><p>구독 데이터베이스는 Cloudflare, Inc.(미국)에 위탁하며 미국 관할 D1 데이터베이스에 이메일과 동의·구독 정보를 저장합니다. Plus Five Five, Inc.(Resend, 미국)에는 인증·뉴스레터 발송을 위해 수신 이메일 주소, 메일 내용, 발송 상태를 전송합니다. 발송 도메인은 일본 도쿄 리전을 사용하며, 제공자의 운영·보안·지원 처리에는 미국 등 하위 처리자의 국가가 포함될 수 있습니다. 신청·인증·발송 시 암호화된 네트워크로 이전합니다.</p>
<p>국외 이전 목적은 구독 관리와 이메일 전달이며, 보관 기간은 위 구독 보관 기간 및 제공자의 로그·백업 보존 정책을 따릅니다. 국외 이전 동의를 거부하거나 철회하려면 구독을 신청하지 않거나 해지해 주세요. 자세한 수탁사 정보·문의·하위 처리자 목록은 <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare 개인정보처리방침</a>, <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Resend 개인정보처리방침</a>, <a href="https://resend.com/legal/subprocessors" target="_blank" rel="noopener noreferrer">Resend 하위 처리자 안내</a>에서 확인하실 수 있습니다.</p>
<h2>메일에서 추적하나요?</h2><p>열람 추적과 클릭 추적은 사용하지 않습니다. 메일 전송이 수락됐다는 상태는 실제 받은 편지함 도착과 다르며, 스팸 분류나 수신 서버 사정으로 지연될 수 있습니다.</p>
<p><a href="/subscribe/">구독 신청으로 돌아가기</a></p>`) }
};
