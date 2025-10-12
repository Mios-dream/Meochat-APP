<template>
  <div id="plugins-content" class="p-5 slide-in">
    <div class="mb-8">
      <h1 class="text-[clamp(1.5rem,3vw,2.5rem)] font-bold mb-2">插件管理</h1>
      <p class="text-gray-500">管理已安装的插件和浏览可用插件</p>
    </div>

    <!-- 插件管理工具栏 -->
    <div
      class="bg-white rounded-xl shadow-soft p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
    >
      <div class="flex items-center">
        <div class="relative">
          <input
            type="text"
            placeholder="搜索插件..."
            class="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors w-full md:w-64"
          />
          <i
            class="fa fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
          ></i>
        </div>
        <select
          class="ml-4 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
        >
          <option>所有插件</option>
          <option>已启用</option>
          <option>已禁用</option>
          <option>需要更新</option>
        </select>
      </div>
      <div class="flex space-x-3">
        <button
          class="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
        >
          <i class="fa fa-refresh mr-2"></i> 刷新列表
        </button>
        <button
          class="px-4 py-2 gradient-bg text-white rounded-lg hover:opacity-90 transition-opacity flex items-center"
        >
          <i class="fa fa-plus mr-2"></i> 安装插件
        </button>
      </div>
    </div>

    <!-- 插件列表 -->
    <div class="bg-white rounded-xl shadow-soft overflow-hidden mb-8">
      <div
        class="grid grid-cols-12 py-3 px-6 bg-gray-50 text-sm font-medium text-gray-500 border-b border-gray-100"
      >
        <div class="col-span-12 md:col-span-4">插件名称</div>
        <div class="hidden md:block md:col-span-2">版本</div>
        <div class="hidden md:block md:col-span-3">最后更新</div>
        <div class="hidden md:block md:col-span-2">状态</div>
        <div class="col-span-12 md:col-span-1 text-right">操作</div>
      </div>

      <div class="divide-y divide-gray-100">
        <!-- 插件项 1 -->
        <div class="grid grid-cols-12 py-4 px-6 items-center hover:bg-gray-50 transition-colors">
          <div class="col-span-12 md:col-span-4">
            <div class="flex items-center">
              <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mr-3">
                <i class="fa fa-envelope text-blue-500"></i>
              </div>
              <div>
                <h4 class="font-medium">邮件助手</h4>
                <p class="text-xs text-gray-500">管理和发送电子邮件</p>
              </div>
            </div>
          </div>
          <div class="hidden md:block md:col-span-2 text-sm">v1.2.0</div>
          <div class="hidden md:block md:col-span-3 text-sm text-gray-500">2023-06-10</div>
          <div class="hidden md:block md:col-span-2">
            <span class="px-2 py-1 rounded-full bg-green-100 text-green-600 text-xs">已启用</span>
          </div>
          <div class="col-span-12 md:col-span-1 text-right">
            <button class="text-gray-400 hover:text-gray-600 transition-colors">
              <i class="fa fa-ellipsis-v"></i>
            </button>
          </div>
        </div>

        <!-- 插件项 2 -->
        <div class="grid grid-cols-12 py-4 px-6 items-center hover:bg-gray-50 transition-colors">
          <div class="col-span-12 md:col-span-4">
            <div class="flex items-center">
              <div class="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mr-3">
                <i class="fa fa-calendar text-purple-500"></i>
              </div>
              <div>
                <h4 class="font-medium">日程管理</h4>
                <p class="text-xs text-gray-500">管理日历和日程提醒</p>
              </div>
            </div>
          </div>
          <div class="hidden md:block md:col-span-2 text-sm">v2.0.1</div>
          <div class="hidden md:block md:col-span-3 text-sm text-gray-500">2023-06-15</div>
          <div class="hidden md:block md:col-span-2">
            <span class="px-2 py-1 rounded-full bg-green-100 text-green-600 text-xs">已启用</span>
          </div>
          <div class="col-span-12 md:col-span-1 text-right">
            <button class="text-gray-400 hover:text-gray-600 transition-colors">
              <i class="fa fa-ellipsis-v"></i>
            </button>
          </div>
        </div>

        <!-- 插件项 3 -->
        <div class="grid grid-cols-12 py-4 px-6 items-center hover:bg-gray-50 transition-colors">
          <div class="col-span-12 md:col-span-4">
            <div class="flex items-center">
              <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mr-3">
                <i class="fa fa-file-text text-green-500"></i>
              </div>
              <div>
                <h4 class="font-medium">文档处理</h4>
                <p class="text-xs text-gray-500">文档转换和格式处理</p>
              </div>
            </div>
          </div>
          <div class="hidden md:block md:col-span-2 text-sm">v1.5.3</div>
          <div class="hidden md:block md:col-span-3 text-sm text-gray-500">2023-05-28</div>
          <div class="hidden md:block md:col-span-2">
            <span class="px-2 py-1 rounded-full bg-green-100 text-green-600 text-xs">已启用</span>
          </div>
          <div class="col-span-12 md:col-span-1 text-right">
            <button class="text-gray-400 hover:text-gray-600 transition-colors">
              <i class="fa fa-ellipsis-v"></i>
            </button>
          </div>
        </div>

        <!-- 插件项 4 -->
        <div class="grid grid-cols-12 py-4 px-6 items-center hover:bg-gray-50 transition-colors">
          <div class="col-span-12 md:col-span-4">
            <div class="flex items-center">
              <div class="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center mr-3">
                <i class="fa fa-music text-yellow-500"></i>
              </div>
              <div>
                <h4 class="font-medium">音乐控制</h4>
                <p class="text-xs text-gray-500">控制音乐播放和管理播放列表</p>
              </div>
            </div>
          </div>
          <div class="hidden md:block md:col-span-2 text-sm">v0.9.2</div>
          <div class="hidden md:block md:col-span-3 text-sm text-gray-500">2023-04-12</div>
          <div class="hidden md:block md:col-span-2">
            <span class="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs">已禁用</span>
          </div>
          <div class="col-span-12 md:col-span-1 text-right">
            <button class="text-gray-400 hover:text-gray-600 transition-colors">
              <i class="fa fa-ellipsis-v"></i>
            </button>
          </div>
        </div>

        <!-- 插件项 5 -->
        <div class="grid grid-cols-12 py-4 px-6 items-center hover:bg-gray-50 transition-colors">
          <div class="col-span-12 md:col-span-4">
            <div class="flex items-center">
              <div class="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center mr-3">
                <i class="fa fa-weather text-red-500"></i>
              </div>
              <div>
                <h4 class="font-medium">天气查询</h4>
                <p class="text-xs text-gray-500">获取实时天气和预报</p>
              </div>
            </div>
          </div>
          <div class="hidden md:block md:col-span-2 text-sm">
            v1.1.0 <span class="text-xs text-blue-500 ml-1">有更新</span>
          </div>
          <div class="hidden md:block md:col-span-3 text-sm text-gray-500">2023-05-05</div>
          <div class="hidden md:block md:col-span-2">
            <span class="px-2 py-1 rounded-full bg-green-100 text-green-600 text-xs">已启用</span>
          </div>
          <div class="col-span-12 md:col-span-1 text-right">
            <button class="text-gray-400 hover:text-gray-600 transition-colors">
              <i class="fa fa-ellipsis-v"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 可用插件 -->
    <div>
      <div class="flex items-center justify-between mb-6">
        <h3 class="font-semibold text-lg">推荐插件</h3>
        <a href="#" class="text-secondary text-sm hover:underline transition-colors">查看全部</a>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- 推荐插件 1 -->
        <div
          class="bg-white rounded-xl shadow-soft overflow-hidden transition-all duration-300 hover:shadow-hover"
        >
          <div class="h-32 bg-gradient-to-r from-blue-400 to-purple-500 relative">
            <div
              class="absolute top-4 right-4 bg-white/90 backdrop-blur-sm text-dark text-xs px-2 py-1 rounded"
            >
              新增
            </div>
          </div>
          <div class="p-5">
            <div class="flex items-center mb-3">
              <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mr-3">
                <i class="fa fa-translate text-blue-500"></i>
              </div>
              <h4 class="font-medium">翻译助手</h4>
            </div>
            <p class="text-sm text-gray-500 mb-4">实时翻译多种语言，支持文档和网页翻译</p>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500">v1.0.0</span>
              <button
                class="px-3 py-1.5 text-sm bg-primary/10 text-secondary rounded-lg hover:bg-primary/20 transition-colors"
              >
                安装
              </button>
            </div>
          </div>
        </div>

        <!-- 推荐插件 2 -->
        <div
          class="bg-white rounded-xl shadow-soft overflow-hidden transition-all duration-300 hover:shadow-hover"
        >
          <div class="h-32 bg-gradient-to-r from-green-400 to-teal-500"></div>
          <div class="p-5">
            <div class="flex items-center mb-3">
              <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mr-3">
                <i class="fa fa-todo text-green-500"></i>
              </div>
              <h4 class="font-medium">待办清单</h4>
            </div>
            <p class="text-sm text-gray-500 mb-4">管理任务和待办事项，支持提醒功能</p>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500">v2.1.3</span>
              <button
                class="px-3 py-1.5 text-sm bg-primary/10 text-secondary rounded-lg hover:bg-primary/20 transition-colors"
              >
                安装
              </button>
            </div>
          </div>
        </div>

        <!-- 推荐插件 3 -->
        <div
          class="bg-white rounded-xl shadow-soft overflow-hidden transition-all duration-300 hover:shadow-hover"
        >
          <div class="h-32 bg-gradient-to-r from-yellow-400 to-orange-500"></div>
          <div class="p-5">
            <div class="flex items-center mb-3">
              <div class="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center mr-3">
                <i class="fa fa-stocks text-yellow-500"></i>
              </div>
              <h4 class="font-medium">股票监控</h4>
            </div>
            <p class="text-sm text-gray-500 mb-4">实时股票行情监控和走势分析</p>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500">v1.5.2</span>
              <button
                class="px-3 py-1.5 text-sm bg-primary/10 text-secondary rounded-lg hover:bg-primary/20 transition-colors"
              >
                安装
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
