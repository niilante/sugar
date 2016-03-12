/**
 * watcher 数据订阅模块
 */
define([
	'./util',
	'./vm-observer'
], function(util, Observer) {

	/**
	 * @param  {Object}  model     [VM数据模型]
	 */
	function Watcher(model) {
		this.$model = model;

		// 监测数据模型回调集合
		this.$watchCallbacks = {};

		// 监测访问路径回调集合
		this.$accessCallbacks = {};

		// 监测数组下标路径集合
		this.$indexCallbacks = {};

		this.observer = new Observer(model, ['$els'], 'triggerAgent', this);
	}
	Watcher.prototype =  {
		constructor: Watcher,

		/**
		 * 添加一个对数据模型字段的监测回调
		 * @param  {String}    field     [监测字段]
		 * @param  {Function}  callback  [变化回调]
		 * @param  {Object}    context   [作用域]
		 * @param  {Array}     args      [回调参数]
		 */
		add: function(field, callback, context, args) {
			var model = this.$model;
			var callbacks = this.$watchCallbacks;

			if (!util.has(field, model)) {
				util.warn('The field: ' + field + ' does not exist in model!');
				return;
			}

			if (field.indexOf('*') !== -1) {
				util.warn('model key cannot contain the character \'*\'!');
				return;
			}

			// 缓存回调函数
			if (!callbacks[field]) {
				callbacks[field] = [];
			}

			callbacks[field].push([callback, context, args]);
		},

		/**
		 * 数据模型变化触发代理
		 * 只触发数据模型定义的字段，数组内部变化通过triggerAccess手动触发
		 * @param   {String}  path  [触发字段访问路径]
		 * @param   {Mix}     last  [新值]
		 * @param   {Mix}     old   [旧值]
		 */
		triggerAgent: function(path, last, old) {
			var pos = path.indexOf('*');
			var field = pos === -1 ? path : path.substr(0, pos);

			// 触发所有回调
			util.each(this.$watchCallbacks[field], function(cbs) {
				var callback = cbs[0], context = cbs[1], args = cbs[2];
				callback.call(context, path, last, old, args);
			}, this);
		},

		/**
		 * 订阅数据模型多层访问路径回调
		 * @param  {String}    access    [访问路径]
		 * @param  {Function}  callback  [变化回调]
		 * @param  {Object}    context   [作用域]
		 * @param  {Array}     args      [回调参数]
		 */
		watchAccess: function(access, callback, context, args) {
			var callbacks = this.$accessCallbacks;

			// 缓存回调函数
			if (!callbacks[access]) {
				callbacks[access] = [];
			}

			callbacks[access].push([callback, context, args]);
		},

		/**
		 * 触发多层访问路径变更回调
		 * @param   {String}  access  [访问路径]
		 * @param   {Mix}     last    [新值]
		 * @param   {Mix}     old     [旧值]
		 */
		triggerAccess: function(access, last, old) {
			var callbacks = this.$accessCallbacks;

			util.each(callbacks[access], function(cb) {
				var callback = cb[0], context = cb[1], args = cb[2];
				callback.call(context, last, old, args);
			});
		},

		/**
		 * 订阅数组操作下标变更回调
		 * @param  {String}    access    [访问路径]
		 * @param  {Function}  callback  [变化回调]
		 * @param  {Object}    context   [作用域]
		 */
		watcherIndex: function(access, callback, context) {
			var callbacks = this.$indexCallbacks;

			// 缓存回调函数
			if (!callbacks[access]) {
				callbacks[access] = [];
			}

			callbacks[access].push([callback, context]);
		},

		/**
		 * 更新访问路径和回调函数的对应关系
		 * 处理数组的unshift/shift操作
		 * @param   {String}   field     [数组访问路径]
		 * @param   {Boolean}  backward  [是否延后一位]
		 */
		updateAccess: function(field, backward) {
			var prefix = field + '*';
			var callbacks = this.$accessCallbacks;
			var accesses = Object.keys(callbacks);
			var indexCallbacks = this.$indexCallbacks;

			// 需要移位的所有访问路径和回调
			var targets = [], cbCaches = {};
			util.each(accesses, function(access) {
				if (access.indexOf(prefix) === 0) {
					targets.push(access);
					cbCaches[access] = callbacks[access];
				}
			});

			util.each(targets, function(current) {
				var index = +current.substr(prefix.length).charAt(0);
				var suffix = current.substr(prefix.length + 1);
				var first = prefix + 0 + suffix;
				var next = prefix + (index + 1) + suffix;
				var udf, indexPath = prefix + index;

				// 延后一位，第一位将为undefined
				if (backward) {
					callbacks[next] = cbCaches[current];
					if (index === 0) {
						callbacks[first] = udf;
					}
					// 更新下标
					util.each(indexCallbacks[indexPath], function(cbs) {
						cbs[0].call(cbs[1], index + 1);
					});
				}
				// 提前一位，最后一位将为undefined
				else {
					callbacks[current] = cbCaches[next];
					// 更新下标
					util.each(indexCallbacks[indexPath], function(cbs) {
						cbs[0].call(cbs[1], index - 1);
					});
				}
			}, this);
		},

		/**
		 * 访问路径回调延后一位，处理数组的unshift操作
		 */
		backwardAccess: function(field) {
			this.updateAccess(field, true);
			return this;
		},

		/**
		 * 访问路径回调提前一位，处理数组的shift操作
		 */
		forwardAccess: function(field) {
			this.updateAccess(field, false);
			return this;
		}
	}

	return Watcher;
});