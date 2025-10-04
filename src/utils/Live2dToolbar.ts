/**
 * 显示右键菜单
 */
function showContextMenu(event: MouseEvent): void {
  // 创建或显示右键菜单
  let contextMenu = document.getElementById('live2d-context-menu')
  if (!contextMenu) {
    contextMenu = document.createElement('div')
    contextMenu.id = 'live2d-context-menu'
    contextMenu.style.position = 'fixed'
    contextMenu.style.backgroundColor = 'white'
    contextMenu.style.border = '1px solid #ccc'
    contextMenu.style.boxShadow = '2px 2px 5px rgba(0,0,0,0.2)'
    contextMenu.style.zIndex = '10000'
    contextMenu.style.display = 'none'
    document.body.appendChild(contextMenu)

    // 添加菜单项示例
    const menuItems = [
      { text: '打招呼', action: () => console.log('打招呼') },
      { text: '隐藏', action: () => console.log('隐藏模型') },
      { text: '退出', action: () => console.log('退出') },
    ]

    menuItems.forEach((item) => {
      const menuItem = document.createElement('div')
      menuItem.textContent = item.text
      menuItem.style.padding = '8px 12px'
      menuItem.style.cursor = 'pointer'
      menuItem.addEventListener('click', () => {
        item.action()
        hideContextMenu()
      })
      menuItem.addEventListener('mouseenter', () => {
        menuItem.style.backgroundColor = '#f0f0f0'
      })
      menuItem.addEventListener('mouseleave', () => {
        menuItem.style.backgroundColor = 'white'
      })
      contextMenu.appendChild(menuItem)
    })
  }

  // 设置菜单位置
  contextMenu.style.left = `${event.x}px`
  contextMenu.style.top = `${event.y}px`
  contextMenu.style.display = 'block'

  // 添加点击其他地方隐藏菜单的事件
  const hideMenu = (event: MouseEvent) => {
    if (!(event.target as HTMLElement).closest('#live2d-context-menu')) {
      hideContextMenu()
      document.removeEventListener('click', hideMenu)
    }
  }
  setTimeout(() => {
    document.addEventListener('click', hideMenu)
  }, 0)
}

/**
 * 隐藏右键菜单
 */
function hideContextMenu(): void {
  const contextMenu = document.getElementById('live2d-context-menu')
  if (contextMenu) {
    contextMenu.style.display = 'none'
  }
}

export { showContextMenu, hideContextMenu }
