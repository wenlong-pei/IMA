import { useEffect, useState } from 'react'
import introJs from 'intro.js'
import 'intro.js/introjs.css'
import './IntroGuide.scss'

// 新手引导步骤配置
const steps = [
  {
    element: '.url-input-wrapper',
    intro: '在这里输入智学网的链接地址，支持 zhixue.com 和 zhixueyun.com',
    position: 'bottom'
  },
  {
    element: '.standards-list',
    intro: '从评分标准列表中选择一个标准，用于AI评分参考',
    position: 'right'
  },
  {
    element: '.mode-selector',
    intro: '选择批改模式：普通模式需要确认，试改模式支持纠错，无人值守全自动',
    position: 'top'
  },
  {
    element: '.action-area',
    intro: '点击"开始自动批改"按钮启动自动化流程',
    position: 'top'
  },
  {
    element: '.preview-card',
    intro: '答题图片将实时显示在这里，你可以预览当前批改的内容',
    position: 'left'
  },
  {
    element: '.logs-card',
    intro: '运行日志会显示批改过程中的详细信息，便于排查问题',
    position: 'left'
  }
]

export default function IntroGuide() {
  const [isFirstVisit, setIsFirstVisit] = useState(false)

  useEffect(() => {
    // 检查是否首次访问
    const hasVisited = localStorage.getItem('pilaoban_intro_completed')
    if (!hasVisited) {
      setIsFirstVisit(true)
    }
  }, [])

  const startIntro = () => {
    const intro = introJs()

    intro.setOptions({
      steps: steps,
      showProgress: true,
      showStepNumbers: true,
      nextLabel: '下一步',
      prevLabel: '上一步',
      skipLabel: '跳过',
      doneLabel: '完成',
      tooltipPosition: 'auto',
      tooltipClass: 'intro-custom-tooltip',
      highlightClass: 'intro-custom-highlight',
      exitOnEsc: true,
      exitOnOverlayClick: false,
      keyboardNavigation: true,
      showBullets: true,
      scrollToElement: true,
      scrollTo: 'tooltip',
      overlayOpacity: 0.7,
    })

    intro.oncomplete(() => {
      localStorage.setItem('pilaoban_intro_completed', 'true')
      setIsFirstVisit(false)
    })

    intro.onskip(() => {
      localStorage.setItem('pilaoban_intro_completed', 'true')
      setIsFirstVisit(false)
    })

    intro.start()
  }

  const resetIntro = () => {
    localStorage.removeItem('pilaoban_intro_completed')
    setIsFirstVisit(true)
    startIntro()
  }

  return {
    isFirstVisit,
    startIntro,
    resetIntro
  }
}

// 导出独立的启动函数
export function startIntroGuide() {
  const intro = introJs()

  intro.setOptions({
    steps: steps,
    showProgress: true,
    showStepNumbers: true,
    nextLabel: '下一步',
    prevLabel: '上一步',
    skipLabel: '跳过',
    doneLabel: '完成',
    tooltipPosition: 'auto',
    tooltipClass: 'intro-custom-tooltip',
    highlightClass: 'intro-custom-highlight',
    exitOnEsc: true,
    exitOnOverlayClick: false,
    keyboardNavigation: true,
    showBullets: true,
    scrollToElement: true,
    scrollTo: 'tooltip',
    overlayOpacity: 0.7,
  })

  intro.oncomplete(() => {
    localStorage.setItem('pilaoban_intro_completed', 'true')
  })

  intro.onkip(() => {
    localStorage.setItem('pilaoban_intro_completed', 'true')
  })

  intro.start()
}

// 导出重置函数
export function resetIntroGuide() {
  localStorage.removeItem('pilaoban_intro_completed')
}
