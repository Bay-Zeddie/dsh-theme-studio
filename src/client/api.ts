// src/client/api.ts —— 浏览器半源码模块（TS 产线）。
// 构建：npm run build:client（tsdown standalone → lib-build/client.js → client.js）。

        /* ============================================================ */
        /* 本地接口：取数与写入都走插件自己的同源路由                       */
        /* ============================================================ */

        export function createApi(getPrefix, getToken) {
          function url(path) { return getPrefix() + path }
          function headers(extra?: any) {
            return Object.assign({ 'x-dts-key': getToken() || '' }, extra || {});
          }
          function unwrap(response) {
            // 代理页/网关 5xx 的非 JSON 响应别让 response.json() 抛裸 SyntaxError
            //（"Unexpected token '<'" 直通状态栏）：折成带 status 的干净错误。
            return response.json().catch(function () {
              var parseError = new Error('HTTP ' + String(response.status));
              parseError.status = response.status;
              throw parseError;
            }).then(function (body) {
              if (body && body.ok === true) return body.value;
              var message = (body && body.error && body.error.message) || ('HTTP ' + response.status);
              var error = new Error(message);
              error.status = (body && body.error && body.error.status) || response.status;
              throw error;
            })
          }
          return {
            getState: function () { return fetch(url('/api/state'), { cache: 'no-store' }).then(unwrap) },
            saveDoc: function (doc: any, expectRevision?: any, signal?: any) {
              return fetch(url('/api/state'), {
                method: 'PUT',
                headers: headers({ 'content-type': 'application/json' }),
                body: JSON.stringify({ doc: doc, expectRevision: expectRevision }),
                signal: signal,
              }).then(unwrap)
            },
            preset: function (id) {
              return fetch(url('/api/preset'), {
                method: 'POST',
                headers: headers({ 'content-type': 'application/json' }),
                body: JSON.stringify({ id: id }),
              }).then(unwrap)
            },
            /** 把 File 直接当请求体：不打包、不 base64、不留内存副本，这是原画质的前提。 */
            upload: function (file: any, onProgress?: any) {
              var target = url('/api/media?name=' + encodeURIComponent(file.name || 'material'));
              return new Promise(function (resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.open('POST', target, true);
                xhr.setRequestHeader('x-dts-key', getToken() || '');
                if (typeof onProgress === 'function') {
                  xhr.upload.addEventListener('progress', function (event) {
                    if (event.lengthComputable) onProgress(event.loaded / event.total);
                  });
                }
                xhr.addEventListener('load', function () {
                  var body = null;
                  try { body = JSON.parse(xhr.responseText) } catch (err) { body = null }
                  if (body && body.ok === true) resolve(body.value)
                  else reject(new Error((body && body.error && body.error.message) || ('HTTP ' + String(xhr.status))))
                });
                xhr.addEventListener('error', function () { reject(new Error('network')) });
                xhr.addEventListener('abort', function () { reject(new Error('abort')) });
                xhr.send(file);
              })
            },
            removeMedia: function (id: any, force?: any) {
              return fetch(url('/api/media/' + encodeURIComponent(id) + (force ? '?force=1' : '')), {
                method: 'DELETE', headers: headers(),
              }).then(unwrap)
            },
            usage: function () { return fetch(url('/api/usage'), { cache: 'no-store' }).then(unwrap) },
            themes: function () { return fetch(url('/api/themes'), { cache: 'no-store' }).then(unwrap) },
            saveTheme: function (name, overwrite) {
              return fetch(url('/api/themes'), {
                method: 'POST', headers: headers({ 'content-type': 'application/json' }),
                body: JSON.stringify({ name: name, overwrite: overwrite === true }),
              }).then(unwrap)
            },
            loadTheme: function (slug) {
              return fetch(url('/api/themes/load'), {
                method: 'POST', headers: headers({ 'content-type': 'application/json' }),
                body: JSON.stringify({ slug: slug }),
              }).then(unwrap)
            },
            removeTheme: function (slug) {
              return fetch(url('/api/themes/' + encodeURIComponent(slug)), {
                method: 'DELETE', headers: headers(),
              }).then(unwrap)
            },
            importDoc: function (doc, mode) {
              return fetch(url('/api/import' + (mode === 'merge' ? '?mode=merge' : '')), {
                method: 'POST', headers: headers({ 'content-type': 'application/json' }),
                body: JSON.stringify({ doc: doc }),
              }).then(unwrap)
            },
            exportUrl: function () { return url('/api/export') },
          };
        }

