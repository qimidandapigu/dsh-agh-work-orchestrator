const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const revealItems = document.querySelectorAll('.reveal')
if (reducedMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach(item => item.classList.add('is-visible'))
} else {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-visible')
      observer.unobserve(entry.target)
    })
  }, { threshold: 0.12 })
  revealItems.forEach(item => observer.observe(item))
}

const progress = document.querySelector('#page-progress')
const updateProgress = () => {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight
  const ratio = scrollable > 0 ? window.scrollY / scrollable : 0
  progress.style.width = `${Math.min(1, Math.max(0, ratio)) * 100}%`
}
window.addEventListener('scroll', updateProgress, { passive: true })
updateProgress()

const navToggle = document.querySelector('.nav-toggle')
const nav = document.querySelector('#site-nav')
navToggle.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open')
  navToggle.setAttribute('aria-expanded', String(open))
})
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('is-open')
  navToggle.setAttribute('aria-expanded', 'false')
}))

const demoButton = document.querySelector('#play-demo')
const whipDemo = document.querySelector('#whip-demo')
const heroWhipDemo = document.querySelector('#hero-whip-demo')
const demoSignals = [...document.querySelectorAll('.demo-signal')]
const flowCards = [...document.querySelectorAll('.flow-card')]
const gameStage = document.querySelector('.game-stage')
const heroVisual = document.querySelector('.hero-visual')
const heroAction = document.querySelector('.image-note')
const actionTitle = document.querySelector('.stage-action b')
const actionHint = document.querySelector('.stage-action small')
let demoTimer
let reportTimer

const clearDemo = () => {
  window.clearTimeout(demoTimer)
  window.clearTimeout(reportTimer)
  demoSignals.forEach(signal => signal.classList.remove('active'))
  flowCards.forEach(card => card.classList.remove('is-active'))
  gameStage?.classList.remove('is-whipped')
  heroVisual?.classList.remove('is-whipped')
  demoButton.textContent = '演示语音 + 小皮鞭'
  heroAction.textContent = '点击小皮鞭，催 NPC 干活'
  actionTitle.textContent = '点击挥动小皮鞭'
  actionHint.textContent = '抽一下，看看 NPC 的反应'
}

const runDemo = ({ scroll = true } = {}) => {
  clearDemo()
  if (scroll) document.querySelector('#demo').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
  demoButton.textContent = 'NPC 被催办中…'
  gameStage?.classList.add('is-whipped')
  heroVisual?.classList.add('is-whipped')
  heroAction.textContent = '啪！AI NPC：马上就好了！'
  demoSignals[1]?.classList.add('active')
  flowCards[1]?.classList.add('is-active')
  actionTitle.textContent = '啪！NPC：马上就好了！'
  actionHint.textContent = '惊讶画面显示 5 秒后自动恢复'

  reportTimer = window.setTimeout(() => {
    demoSignals[1]?.classList.remove('active')
    demoSignals[2]?.classList.add('active')
    flowCards[1]?.classList.remove('is-active')
    flowCards[3]?.classList.add('is-active')
  }, 650)

  demoTimer = window.setTimeout(clearDemo, 5000)
}

demoButton.addEventListener('click', () => runDemo({ scroll: true }))
whipDemo.addEventListener('click', () => runDemo({ scroll: false }))
heroWhipDemo.addEventListener('click', () => runDemo({ scroll: false }))
