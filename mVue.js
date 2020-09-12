class Dep {
  constructor() {
    this.subs = []
  }
  //订阅
  addSub(watcher) {
    this.subs.push(watcher) //存放所有的watcher
  }
  // 发布
  notify() {
    this.subs.forEach((watcher) => {
      watcher.update()
    })
  }
}

//观察者类

class Watcher {
  constructor(vm, expr, callback) {
    this.vm = vm
    this.expr = expr
    this.callback = callback
    // 默认存放一个老值
    this.oldValue = this.get()
  }
  get() {
    Dep.target = this
    let value = compileUtils.getVal(this.vm, this.expr)
    Dep.target = null
    return value
  }
  update() {
    //更新数据 数据变化后 会调用观察者的update方法
    let newValue = compileUtils.getVal(this.vm, this.expr)
    if (newValue !== this.oldValue) {
      this.callback(newValue)
    }
  }
}

//数据劫持类
class Observer {
  constructor(data) {
    this.observer(data)
  }
  observer(data) {
    if (data && typeof data === 'object') {
      for (let key in data) {
        this.defineReactive(data, key, data[key])
      }
    }
  }

  defineReactive(obj, key, value) {
    this.observer(value)
    let dep = new Dep()
    Object.defineProperty(obj, key, {
      get() {
        Dep.target && dep.addSub(Dep.target)
        return value
      },
      set: (newValue) => {
        if (newValue !== value) {
          this.observer(newValue)
          value = newValue
          dep.notify()
        }
      },
    })
  }
}

//处理指令的工具类
const compileUtils = {
  html(node, expr, vm) {
    let fn = this.updater.htmlUpdate
    new Watcher(vm, expr, (newValue) => {
      fn(node, newValue)
    })

    value = this.getVal(vm, expr)
    fn(node, value)
  },
  getContentValue(vm, expr) {
    return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
      return this.getVal(vm, args[1])
    })
  },

  text(node, expr, vm) {
    let fn = this.updater.textUpdate
    let content
    //如果是直接以  {{}}的
    if (/\{\{(.+?)\}\}/g.test(expr)) {
      content = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
        new Watcher(vm, args[1], () => {
          console.log(expr)
          fn(node, this.getContentValue(vm, expr)) //返回一个全的字符串
        })
        let value = this.getVal(vm, args[1])
        return value
      })
      fn(node, content)
    } else {
      //如果是以 v-text的指令的
      let value = this.getVal(vm, expr)
      new Watcher(vm, expr, (newValue) => {
        fn(node, newValue)
      })
      fn(node, value)
    }
  },
  on(node, expr, vm, eventName) {
    node.addEventListener(eventName, (event) => {
      vm[expr].call(vm, event)
    })
  },
  model(node, expr, vm) {
    let fn = this.updater.modelUpdate
    //添加一个观察者
    new Watcher(vm, expr, (newValue) => {
      fn(node, newValue)
    })
    node.addEventListener('input', (e) => {
      let value = e.currentTarget.value
      this.setValue(vm, expr, value)
    })
    let value = this.getVal(vm, expr)
    fn(node, value)
  },
  bind(node, expr, vm) {},

  updater: {
    htmlUpdate(node, value) {
      node.innerHTML = value
    },
    textUpdate(node, value) {
      node.textContent = value
    },
    modelUpdate(node, value) {
      node.value = value
    },
    bindUpdate(node, value) {},
  },
  setValue(vm, expr, value) {
    expr.split('.').reduce((data, current, index, arr) => {
      if (index === arr.length - 1) {
        return (data[current] = value)
      }
      return data[current]
    }, vm.$data)
  },
  getVal(vm, expr) {
    // expr person.name
    return expr.split('.').reduce((data, current) => {
      return data[current]
    }, vm.$data)
  },
}

//编译器类
class Compiler {
  constructor(el, vm) {
    this.el = this.isElementNode(el) ? el : document.querySelector(el)

    this.vm = vm

    this.data = vm.$data

    let fragment = this.node2fragment(this.el)

    //进行编译
    this.compiler(fragment)

    this.el.appendChild(fragment)
  }

  //判断是不是一个指令的方法
  isDirective(name) {
    //判断是不是一个指令(是不是以v-开头)
    return name.startsWith('v-')
  }

  //编译元素
  compileElement(node) {
    //如果是元素获取节点上的属性
    let attributes = node.attributes
    ;[...attributes].forEach((attr) => {
      let { name, value: expr } = attr
      //如果是一个指令
      if (this.isDirective(name)) {
        //分割字符串
        let [, Directive] = name.split('-')
        let [DirectiveName, eventName] = Directive.split(':')
        compileUtils[DirectiveName](node, expr, this.vm, eventName)
      }
    })
  }

  //编译文本的方法
  compileText(node) {
    let content = node.textContent
    //console.log(content)
    if (/\{\{(.+?)\}\}/.test(content)) {
      //调用工具类的text方法
      compileUtils['text'](node, content, this.vm)
    }
  }

  compiler(node) {
    let childerNodes = node.childNodes
    ;[...childerNodes].forEach((node) => {
      //如果是一个元素节点
      if (this.isElementNode(node)) {
        this.compileElement(node)
        //递归调用 如果该元素中还存在子节点
        this.compiler(node)
      } else {
        //如果是一个文本节点
        this.compileText(node)
      }
    })
  }

  isElementNode(element) {
    //判断是不是一个元素节点
    return element.nodeType === 1
  }

  //将元素先保存到文档碎片中(内存),避免每次更新渲染回流和重绘
  node2fragment(node) {
    //创建一个文档碎片
    let fragment = document.createDocumentFragment()

    let firstChild

    while ((firstChild = node.firstChild)) {
      //appendChild具有移动性
      fragment.appendChild(firstChild)
    }
    return fragment
  }
}

//创建一个基类
class Vue {
  //构造器
  constructor(options) {
    //console.log('执行构造器方法。')
    this.$el = options.el
    this.$data = options.data
    let computed = options.computed
    let methods = options.methods
    //判断是否存在el元素
    if (this.$el) {
      new Observer(this.$data)

      for (let key in computed) {
        //如果属性的值是一个函数
        if (typeof computed[key] === 'function') {
          Object.defineProperty(this.$data, key, {
            get: () => {
              return computed[key].call(this)
            },
          })
        } else {
          //如果属性的值是一个对象
          Object.defineProperty(this.$data, key, {
            get: () => {
              return computed[key].get.call(this)
            },
            set: (newValue) => {
              computed[key].set.call(this, newValue)
            },
          })
        }
      }

      for (let key in methods) {
        Object.defineProperty(this, key, {
          get() {
            return methods[key]
          },
        })
      }

      //代理
      this.proxyVm(this.$data)
      //调用编译器，进行编译
      new Compiler(this.$el, this) //将元素和实例传给编译器
    }
  }
  proxyVm(data) {
    for (let key in data) {
      Object.defineProperty(this, key, {
        get() {
          return data[key]
        },
        set(newValue) {
          data[key] = newValue
        },
      })
    }
  }
}
