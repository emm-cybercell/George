export default defineAppConfig({
  pages: [
    "pages/home/index",
    "pages/learn/index",
    "pages/profile/index",
    "pages/history/index",
    "pages/portfolio/index",
    "pages/notifications/index",
    "pages/settings/index",
    "pages/about/index",
    "pages/team/index",
    "pages/feature-detail/index",
    "pages/ability-setting/index",
  ],
  plugins: {
    WechatSI: {
      version: "0.3.10",
      provider: "wx069ba97219f66d99",
    },
  },
  // 录音授权（scope.record）由录音 API 运行时自动请求；
  // app.json 的 permission 字段仅支持 scope.userLocation，声明会报"无效的 permission"警告
  window: {
    backgroundTextStyle: "light",
    navigationBarBackgroundColor: "#8B5CF6",
    navigationBarTitleText: "桥智同学",
    navigationBarTextStyle: "white",
    navigationStyle: "custom",
  },
});
