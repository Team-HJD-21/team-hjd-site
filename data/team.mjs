// Public information only. Omit a field (or use an empty value / X) to hide it.
export const members = [
  {
    id: 'yang-hyunseok', slug: 'yang-hyunseok', rosterName: 'YANG HYUNSEOK',
    name: '양현석', englishName: 'Yang HyunSeok', profileEnabled: true,
    shortBio: '호기심을 가지고, 방법을 찾는 개발자 양현석입니다.',
    links: [
      {label: 'Portfolio', href: 'https://buly.kr/1GL01Px', icon: 'portfolio'},
      {label: 'LinkedIn', href: 'https://www.linkedin.com/in/현석-양-8b5a32380', icon: 'linkedin'},
      {label: 'GitHub', href: 'https://github.com/yanggogi1423', icon: 'github'},
    ],
    contactEmail: 'hyunseok@teamhjd.com',
    image: {src: 'assets/team/yang-hyunseok.png', alt: '양현석', position: '50% 42%'},
    interests: ['GamePlay Systems', 'Real-time Graphics', 'UX'],
    organizationTitle: {ko: '공동대표', en: 'Co-founder', 'zh-CN': '联合创始人'},
  },
  {
    id: 'hwang-jaedong', slug: 'hwang-jaedong', rosterName: 'HWANG JAEDONG',
    name: '황재동', englishName: 'Hwang Jaedong', profileEnabled: true,
    shortBio: '보는 즐거움과 플레이하는 재미를 고민하며, TeamHJD의 게임을 만듭니다.',
    links: [
      {label: 'GitHub', href: 'https://github.com/hjd5031', icon: 'github'},
      {label: 'Velog', href: 'https://velog.io/@hjd5031/posts', icon: 'blog'},
      {label: 'LinkedIn', href: 'https://www.linkedin.com/in/jaedong-hwang-67198b382', icon: 'linkedin'},
    ],
    contactEmail: 'jdhwang@teamhjd.com',
    image: {
      src: 'assets/team/hwang-jaedong-01.jpg', alt: '황재동', width: 1154, height: 1440, position: '50% 50%',
      alternatives: [
        {src: 'assets/team/hwang-jaedong-02.jpg', alt: '황재동', width: 1080, height: 1440, position: '50% 50%'},
      ],
    },
    interests: ['Real-time Graphics', 'Gameplay Programming', 'Virtual Production'],
    organizationTitle: {ko: '공동대표', en: 'Co-founder', 'zh-CN': '联合创始人'},
  },
  {
    id: 'kim-jintae', slug: 'kim-jintae', rosterName: 'KIM JINTAE',
    name: '김진태', englishName: 'Kim Jintae', profileEnabled: true,
    shortBio: null,
    links: [{label: 'Portfolio', href: 'https://rocky-packet-e2e.notion.site/2cb534699eb680a18ddbfc4b74ca65cd?source=copy_link', icon: 'portfolio'}],
    contactEmail: 'verbal0719@naver.com',
    // Explicit visitor-facing placeholder requested by the site owner.
    portraitPlaceholder: 'null',
    interests: ['Gameplay Programming', 'Timeline-based Cinematics'],
  },
  {
    id: 'lee-youngbin', slug: 'lee-youngbin', rosterName: 'LEE YOUNGBIN',
    name: '이영빈', englishName: 'Lee Youngbin', profileEnabled: true,
    shortBio: '안녕하세요 이영빈입니다 쓲껄',
    links: [{label: 'GitHub', href: 'https://github.com/COKINGDING', icon: 'github'}],
    contactEmail: 'qls030951@gmail.com',
    image: {src: 'assets/team/lee-youngbin.png', alt: '이영빈이 제공한 캐릭터 그림', width: 1179, height: 2096, position: '50% 58%'},
    interests: ['Game Design', 'Game Programming'],
  },
  {
    id: 'jo-subin', slug: 'jo-subin', rosterName: 'JO SUBIN',
    name: 'Josubin (theFireFly)', profileEnabled: true,
    shortBio: 'AI 따위는 나를 대체하지 못한다.',
    links: [{label: 'GitHub', href: 'https://github.com/theFireFly-Night', icon: 'github'}],
    contactEmail: 'subinjo.dev@gmail.com',
    image: {src: 'assets/team/jo-subin.png', alt: 'Josubin (theFireFly)', width: 413, height: 531, position: '50% 40%'},
    interests: ['Gameplay Programming'],
  },
];

// Roles are entered by the operator, never inferred from a person's interests.
export const projects = [
  {id: 'the-developer', anchor: 'project-team', participants: [
    {memberId: 'yang-hyunseok', roles: ['Lead', 'Core Systems', 'UI']},
    {memberId: 'hwang-jaedong', roles: ['Defense', 'Progression', 'Balance']},
    {memberId: 'kim-jintae', roles: ['World', 'Missions', 'Ally Agent']},
    {memberId: 'lee-youngbin', roles: ['Player', 'Combat/Co-op', 'Cinematics']},
    {memberId: 'jo-subin', roles: ['Enemy', 'Encounter', 'AI']},
  ]},
];
