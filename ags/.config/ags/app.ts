import app from "ags/gtk4/app"
import style from "./style.scss"
import Sidebar from "./widget/sidebar/Sidebar"
import NotificationPopup from "./widget/notification/NotificationPopup"

app.start({
  css: style,
  main() {
    Sidebar()
    NotificationPopup()
  },
})
