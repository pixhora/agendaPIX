/** Menu, botão fixo e tema. Sem React: não entra no caminho do título. */
export const landingBootScript = `(function(){
  var menuOpen = false;

  function button(){ return document.getElementById("landing-menu-button"); }
  function template(){ return document.getElementById("landing-menu-source"); }
  function bar(){ return document.getElementById("sticky-cta"); }
  function outsideTemplate(node){
    return node && !node.closest("template") ? node : null;
  }
  function layer(){ return outsideTemplate(document.getElementById("landing-menu-layer")); }
  function dialog(){ return outsideTemplate(document.getElementById("landing-menu")); }

  function setButton(open){
    var node = button();
    if(!node) return;
    node.setAttribute("aria-expanded", open ? "true" : "false");
    node.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    var openIcon = node.querySelector("[data-icon='open']");
    var closeIcon = node.querySelector("[data-icon='close']");
    if(openIcon) openIcon.hidden = open;
    if(closeIcon) closeIcon.hidden = !open;
  }

  function unlock(){
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  function closeMenu(restore){
    var node = layer();
    if(node) node.remove();
    menuOpen = false;
    setButton(false);
    unlock();
    if(restore && button()) button().focus();
    updateBar();
  }

  function openMenu(){
    var source = template();
    if(!source || !source.textContent || layer()) return;
    var holder = document.createElement("div");
    holder.innerHTML = source.textContent;
    if(!holder.firstElementChild) return;
    document.body.appendChild(holder.firstElementChild);
    menuOpen = true;
    setButton(true);
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    var first = dialog() && dialog().querySelector("a[href]");
    if(first) first.focus();
    updateBar();
  }

  function focusables(root){
    return Array.prototype.slice.call(root.querySelectorAll("a[href], button:not([disabled])"));
  }

  document.addEventListener("click", function(event){
    var target = event.target;
    if(!(target instanceof Element)) return;
    if(target.closest("#landing-menu-button")){
      if(menuOpen) closeMenu(false); else openMenu();
      return;
    }
    if(target.closest("#landing-menu-overlay")){ closeMenu(true); return; }
    if(target.closest("#landing-menu a")) closeMenu(false);
  });

  document.addEventListener("keydown", function(event){
    var root = dialog();
    if(!root) return;
    if(event.key === "Escape"){ event.preventDefault(); closeMenu(true); return; }
    if(event.key !== "Tab") return;
    var items = focusables(root);
    if(!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    var active = document.activeElement;
    if(event.shiftKey && (active === first || !root.contains(active))){ event.preventDefault(); last.focus(); }
    else if(!event.shiftKey && active === last){ event.preventDefault(); first.focus(); }
  });

  document.addEventListener("wheel", function(event){
    var root = dialog();
    if(!root) return;
    if(event.target instanceof Node && root.contains(event.target)) return;
    event.preventDefault();
  }, { passive: false });
  document.addEventListener("touchmove", function(event){
    var root = dialog();
    if(!root) return;
    if(event.target instanceof Node && root.contains(event.target)) return;
    event.preventDefault();
  }, { passive: false });

  var desktop = window.matchMedia("(min-width: 768px)");
  desktop.addEventListener("change", function(){ if(desktop.matches) closeMenu(false); });

  var heroGone = false, finalVisible = false, footerVisible = false;
  var narrowMedia = window.matchMedia("(max-width: 767px)");
  function keyboardOpen(){
    var viewport = window.visualViewport;
    return viewport ? viewport.height < window.innerHeight * 0.75 : false;
  }
  function fieldFocused(){
    var tag = document.activeElement && document.activeElement.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }
  function updateBar(){
    var node = bar();
    if(!node) return;
    var visible = heroGone && !finalVisible && !footerVisible && !menuOpen && narrowMedia.matches && !keyboardOpen() && !fieldFocused();
    node.dataset.visible = visible ? "true" : "false";
    node.setAttribute("aria-hidden", visible ? "false" : "true");
    if(visible) node.removeAttribute("inert"); else node.setAttribute("inert", "");
    node.classList.toggle("translate-y-0", visible);
    node.classList.toggle("translate-y-full", !visible);
    node.classList.toggle("pointer-events-none", !visible);
    document.documentElement.style.setProperty("--sticky-cta-height", visible ? node.offsetHeight + "px" : "0px");
  }
  var armed = false;
  function arm(){
    var node = bar();
    if(node && node.parentElement !== document.body) document.body.appendChild(node);
    if(armed) { updateBar(); return; }
    armed = true;
    var hero = document.getElementById("hero-primary-cta");
    var finalCta = document.getElementById("cta-final");
    var footer = document.getElementById("rodape");
    if(hero && finalCta && footer && "IntersectionObserver" in window){
      var observer = new IntersectionObserver(function(entries){
        for(var i = 0; i < entries.length; i++){
          var entry = entries[i];
          if(entry.target === hero) heroGone = !entry.isIntersecting;
          if(entry.target === finalCta) finalVisible = entry.isIntersecting;
          if(entry.target === footer) footerVisible = entry.isIntersecting;
        }
        updateBar();
      }, { threshold: 0 });
      observer.observe(hero);
      observer.observe(finalCta);
      observer.observe(footer);
    }
    window.addEventListener("resize", updateBar);
    window.addEventListener("focusin", updateBar);
    window.addEventListener("focusout", updateBar);
    if(window.visualViewport) window.visualViewport.addEventListener("resize", updateBar);
    narrowMedia.addEventListener("change", updateBar);
    updateBar();
  }

  var themeKey = "agenda-theme";
  function themePref(){
    try {
      var value = localStorage.getItem(themeKey);
      return value === "light" || value === "dark" ? value : "system";
    } catch(e) { return "system"; }
  }
  function paintTheme(pref){
    var dark = pref === "dark" || (pref !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.classList.toggle("light", !dark);
    root.style.colorScheme = dark ? "dark" : "light";
    var buttons = document.querySelectorAll("[data-theme]");
    for(var i = 0; i < buttons.length; i++){
      var on = buttons[i].getAttribute("data-theme") === pref;
      buttons[i].setAttribute("aria-checked", on ? "true" : "false");
      buttons[i].classList.toggle("bg-ink", on);
      buttons[i].classList.toggle("text-paper", on);
      buttons[i].classList.toggle("hover:text-paper", on);
    }
  }
  function chooseTheme(pref){
    try {
      if(pref === "system") localStorage.removeItem(themeKey);
      else localStorage.setItem(themeKey, pref);
    } catch(e) {}
    paintTheme(pref);
  }
  paintTheme(themePref());
  document.addEventListener("click", function(event){
    var target = event.target;
    if(!(target instanceof Element)) return;
    var choice = target.closest("[data-theme]");
    if(!choice) return;
    chooseTheme(choice.getAttribute("data-theme") || "system");
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function(){
    if(themePref() === "system") paintTheme("system");
  });
  // Mover o botão fixo antes da hidratação faz o React recriar a página.
  function start(){ setTimeout(arm, 50); setTimeout(arm, 400); }
  if(document.readyState === "complete") start();
  else window.addEventListener("load", start);
})();`;
