/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/auth/[...nextauth]/route";
exports.ids = ["app/api/auth/[...nextauth]/route"];
exports.modules = {

/***/ "(rsc)/./app/api/auth/[...nextauth]/route.ts":
/*!*********************************************!*\
  !*** ./app/api/auth/[...nextauth]/route.ts ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   GET: () => (/* binding */ handler),\n/* harmony export */   POST: () => (/* binding */ handler)\n/* harmony export */ });\n/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! fs */ \"fs\");\n/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! path */ \"path\");\n/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var next_auth__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next-auth */ \"(rsc)/./node_modules/next-auth/index.js\");\n/* harmony import */ var next_auth__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_auth__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var next_auth_providers_azure_ad__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! next-auth/providers/azure-ad */ \"(rsc)/./node_modules/next-auth/providers/azure-ad.js\");\n/* harmony import */ var next_auth_providers_credentials__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! next-auth/providers/credentials */ \"(rsc)/./node_modules/next-auth/providers/credentials.js\");\n/* harmony import */ var _lib_config__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @/lib/config */ \"(rsc)/./lib/config.ts\");\n// Load .env from parent directory before NextAuth initializes\n// This ensures Azure AD env vars are available\n\n\ntry {\n    const envPath = (0,path__WEBPACK_IMPORTED_MODULE_1__.resolve)(process.cwd(), '../.env');\n    const envFile = (0,fs__WEBPACK_IMPORTED_MODULE_0__.readFileSync)(envPath, 'utf-8');\n    const envLines = envFile.split('\\n');\n    envLines.forEach((line)=>{\n        const trimmedLine = line.trim();\n        if (!trimmedLine || trimmedLine.startsWith('#')) return;\n        const equalIndex = trimmedLine.indexOf('=');\n        if (equalIndex === -1) return;\n        const key = trimmedLine.substring(0, equalIndex).trim();\n        const value = trimmedLine.substring(equalIndex + 1).trim();\n        const cleanValue = value.replace(/^[\"']|[\"']$/g, '');\n        if (!process.env[key]) {\n            process.env[key] = cleanValue;\n        }\n    });\n} catch (error) {\n// Silently fail - env vars might already be loaded from next.config.mjs\n}\n\n\n\n\n/**\n * Ensure user exists in database by calling backend API\n * Frontend no longer connects directly to database\n */ async function ensureUserUuidByEmail(email) {\n    if (!email) return null;\n    try {\n        const response = await fetch(`${_lib_config__WEBPACK_IMPORTED_MODULE_5__.API_CONFIG.baseUrl}/api/users/ensure`, {\n            method: \"POST\",\n            headers: {\n                \"Content-Type\": \"application/json\"\n            },\n            body: JSON.stringify({\n                email\n            })\n        });\n        if (!response.ok) {\n            console.error(`❌ Failed to ensure user: HTTP ${response.status}`);\n            return null;\n        }\n        const data = await response.json();\n        return data.id || null;\n    } catch (error) {\n        console.error(\"❌ Error ensuring user:\", error);\n        return null;\n    }\n}\n// Helper để validate GUID format\nfunction isValidGuid(value) {\n    if (!value) return false;\n    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;\n    return guidRegex.test(value);\n}\n// Chỉ enable Azure AD provider nếu có đủ config và đúng format\nconst azureAdConfig = {\n    clientId: process.env.AZURE_AD_CLIENT_ID,\n    clientSecret: process.env.AZURE_AD_CLIENT_SECRET,\n    tenantId: process.env.AZURE_AD_TENANT_ID\n};\nconst providers = [];\n// Chỉ thêm Azure AD provider nếu có đủ config và đúng format\nconsole.log(\"🔍 Azure AD Config Check:\", {\n    hasClientId: !!azureAdConfig.clientId,\n    hasClientSecret: !!azureAdConfig.clientSecret,\n    hasTenantId: !!azureAdConfig.tenantId,\n    clientIdValid: azureAdConfig.clientId ? isValidGuid(azureAdConfig.clientId) : false,\n    tenantIdValid: azureAdConfig.tenantId ? isValidGuid(azureAdConfig.tenantId) : false,\n    clientIdPreview: azureAdConfig.clientId ? `${azureAdConfig.clientId.substring(0, 8)}...` : \"missing\",\n    tenantIdPreview: azureAdConfig.tenantId ? `${azureAdConfig.tenantId.substring(0, 8)}...` : \"missing\"\n});\nif (azureAdConfig.clientId && azureAdConfig.clientSecret && azureAdConfig.tenantId && isValidGuid(azureAdConfig.clientId) && isValidGuid(azureAdConfig.tenantId)) {\n    providers.push((0,next_auth_providers_azure_ad__WEBPACK_IMPORTED_MODULE_3__[\"default\"])({\n        clientId: azureAdConfig.clientId,\n        clientSecret: azureAdConfig.clientSecret,\n        tenantId: azureAdConfig.tenantId\n    }));\n    console.log(\"✅ Azure AD provider enabled\");\n} else {\n    console.warn(\"⚠️  Azure AD provider disabled - missing or invalid configuration\");\n    if (!azureAdConfig.clientId) {\n        console.warn(\"   ❌ Missing AZURE_AD_CLIENT_ID\");\n    } else if (!isValidGuid(azureAdConfig.clientId)) {\n        console.warn(`   ❌ Invalid AZURE_AD_CLIENT_ID format: ${azureAdConfig.clientId}`);\n        console.warn(`      Expected GUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`);\n    }\n    if (!azureAdConfig.clientSecret) {\n        console.warn(\"   ❌ Missing AZURE_AD_CLIENT_SECRET\");\n    }\n    if (!azureAdConfig.tenantId) {\n        console.warn(\"   ❌ Missing AZURE_AD_TENANT_ID\");\n    } else if (!isValidGuid(azureAdConfig.tenantId)) {\n        console.warn(`   ❌ Invalid AZURE_AD_TENANT_ID format: ${azureAdConfig.tenantId}`);\n        console.warn(`      Expected GUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`);\n    }\n}\nconst handler = next_auth__WEBPACK_IMPORTED_MODULE_2___default()({\n    // Trust host để NextAuth tự detect origin từ request headers\n    // Điều này giúp xử lý đúng khi chạy qua proxy hoặc load balancer\n    trustHost: true,\n    providers: [\n        ...providers,\n        (0,next_auth_providers_credentials__WEBPACK_IMPORTED_MODULE_4__[\"default\"])({\n            name: \"Credentials\",\n            credentials: {\n                email: {\n                    label: \"Email\",\n                    type: \"text\",\n                    placeholder: \"jsmith@example.com\"\n                },\n                password: {\n                    label: \"Password\",\n                    type: \"password\"\n                }\n            },\n            async authorize (credentials, req) {\n                // Add your own logic here to retrieve a user from a database\n                // For demonstration, we'll use a simple hardcoded user\n                if (credentials?.email === \"user@example.com\" && credentials?.password === \"password123\") {\n                    // Any object returned will be saved in `user` property of the JWT\n                    // lấy/ tạo uuid theo email\n                    const uid = await ensureUserUuidByEmail(credentials.email);\n                    return {\n                        id: uid ?? \"00000000-0000-0000-0000-000000000000\",\n                        name: \"Test User\",\n                        email: credentials.email\n                    };\n                } else {\n                    // If you return null then an error will be displayed advising the user they are unable to sign in.\n                    return null;\n                // You can also Reject this callback with an Error thus the user will be sent to the error page with the error message as a query parameter\n                }\n            }\n        })\n    ],\n    secret: process.env.NEXTAUTH_SECRET,\n    pages: {\n        signIn: \"/login\"\n    },\n    callbacks: {\n        async jwt ({ token, user, account, profile }) {\n            if (user) {\n                // Nếu là CredentialsProvider → user.id đã có sẵn\n                // Nếu là AzureAD → cần tạo/ lấy uuid\n                const uid = await ensureUserUuidByEmail(user.email);\n                token.id = uid ?? \"00000000-0000-0000-0000-000000000000\";\n                token.provider = account?.provider ?? token.provider;\n                token.profile = profile ?? token.profile;\n            }\n            if (account?.access_token) token.accessToken = account.access_token;\n            return token;\n        },\n        async session ({ session, token }) {\n            // Send properties to the client, such as an access_token from a provider.\n            session.accessToken = token.accessToken;\n            session.user.id = token.id;\n            session.user.profile = token.profile // Add profile to session\n            ;\n            session.user.provider = token.provider // Add provider to session\n            ;\n            session.user.image = token.picture || session.user.image || null;\n            return session;\n        },\n        async redirect ({ url, baseUrl }) {\n            // Ưu tiên sử dụng baseUrl từ NextAuth (được detect từ request headers)\n            // Nếu không có, fallback về NEXTAUTH_URL env variable\n            // Nếu url là relative path (bắt đầu bằng /)\n            if (url.startsWith(\"/\")) {\n                // Sử dụng baseUrl từ NextAuth (đã được detect từ request)\n                // baseUrl sẽ là origin của request hiện tại (localhost:3000 hoặc research.neu.edu.vn)\n                return `${baseUrl}${url}`;\n            }\n            // Nếu url là absolute URL\n            try {\n                const urlObj = new URL(url);\n                const baseUrlObj = new URL(baseUrl);\n                // Nếu cùng origin với baseUrl -> cho phép\n                if (urlObj.origin === baseUrlObj.origin) {\n                    return url;\n                }\n                // Nếu khác origin -> redirect về baseUrl với path từ url\n                return `${baseUrl}${urlObj.pathname}${urlObj.search}`;\n            } catch (error) {\n                // Nếu có lỗi parse URL, fallback về trang chủ của baseUrl\n                return `${baseUrl}/assistants/main`;\n            }\n        }\n    }\n});\n\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9hcHAvYXBpL2F1dGgvWy4uLm5leHRhdXRoXS9yb3V0ZS50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUFBLDhEQUE4RDtBQUM5RCwrQ0FBK0M7QUFDZDtBQUNIO0FBRTlCLElBQUk7SUFDRixNQUFNRSxVQUFVRCw2Q0FBT0EsQ0FBQ0UsUUFBUUMsR0FBRyxJQUFJO0lBQ3ZDLE1BQU1DLFVBQVVMLGdEQUFZQSxDQUFDRSxTQUFTO0lBQ3RDLE1BQU1JLFdBQVdELFFBQVFFLEtBQUssQ0FBQztJQUUvQkQsU0FBU0UsT0FBTyxDQUFDQyxDQUFBQTtRQUNmLE1BQU1DLGNBQWNELEtBQUtFLElBQUk7UUFDN0IsSUFBSSxDQUFDRCxlQUFlQSxZQUFZRSxVQUFVLENBQUMsTUFBTTtRQUVqRCxNQUFNQyxhQUFhSCxZQUFZSSxPQUFPLENBQUM7UUFDdkMsSUFBSUQsZUFBZSxDQUFDLEdBQUc7UUFFdkIsTUFBTUUsTUFBTUwsWUFBWU0sU0FBUyxDQUFDLEdBQUdILFlBQVlGLElBQUk7UUFDckQsTUFBTU0sUUFBUVAsWUFBWU0sU0FBUyxDQUFDSCxhQUFhLEdBQUdGLElBQUk7UUFDeEQsTUFBTU8sYUFBYUQsTUFBTUUsT0FBTyxDQUFDLGdCQUFnQjtRQUVqRCxJQUFJLENBQUNoQixRQUFRaUIsR0FBRyxDQUFDTCxJQUFJLEVBQUU7WUFDckJaLFFBQVFpQixHQUFHLENBQUNMLElBQUksR0FBR0c7UUFDckI7SUFDRjtBQUNGLEVBQUUsT0FBT0csT0FBWTtBQUNuQix3RUFBd0U7QUFDMUU7QUFFZ0M7QUFDMEI7QUFDTztBQUN4QjtBQUV6Qzs7O0NBR0MsR0FDRCxlQUFlSyxzQkFBc0JDLEtBQXFCO0lBQ3RELElBQUksQ0FBQ0EsT0FBTyxPQUFPO0lBRW5CLElBQUk7UUFDQSxNQUFNQyxXQUFXLE1BQU1DLE1BQU0sR0FBR0osbURBQVVBLENBQUNLLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFO1lBQ25FQyxRQUFRO1lBQ1JDLFNBQVM7Z0JBQ0wsZ0JBQWdC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QUNaLDBEQUEwRDtnQkFDMUQsT0FBTyxHQUFHUyxRQUFRLGdCQUFnQixDQUFDO1lBQ3ZDO1FBQ0o7SUFDSjtBQUNKO0FBRTBDIiwic291cmNlcyI6WyIvVXNlcnMvbWFjL0N1cnNvci9SZXNlYXJjaC9mcm9udGVuZC9hcHAvYXBpL2F1dGgvWy4uLm5leHRhdXRoXS9yb3V0ZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBMb2FkIC5lbnYgZnJvbSBwYXJlbnQgZGlyZWN0b3J5IGJlZm9yZSBOZXh0QXV0aCBpbml0aWFsaXplc1xuLy8gVGhpcyBlbnN1cmVzIEF6dXJlIEFEIGVudiB2YXJzIGFyZSBhdmFpbGFibGVcbmltcG9ydCB7IHJlYWRGaWxlU3luYyB9IGZyb20gJ2ZzJ1xuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ3BhdGgnXG5cbnRyeSB7XG4gIGNvbnN0IGVudlBhdGggPSByZXNvbHZlKHByb2Nlc3MuY3dkKCksICcuLi8uZW52JylcbiAgY29uc3QgZW52RmlsZSA9IHJlYWRGaWxlU3luYyhlbnZQYXRoLCAndXRmLTgnKVxuICBjb25zdCBlbnZMaW5lcyA9IGVudkZpbGUuc3BsaXQoJ1xcbicpXG4gIFxuICBlbnZMaW5lcy5mb3JFYWNoKGxpbmUgPT4ge1xuICAgIGNvbnN0IHRyaW1tZWRMaW5lID0gbGluZS50cmltKClcbiAgICBpZiAoIXRyaW1tZWRMaW5lIHx8IHRyaW1tZWRMaW5lLnN0YXJ0c1dpdGgoJyMnKSkgcmV0dXJuXG4gICAgXG4gICAgY29uc3QgZXF1YWxJbmRleCA9IHRyaW1tZWRMaW5lLmluZGV4T2YoJz0nKVxuICAgIGlmIChlcXVhbEluZGV4ID09PSAtMSkgcmV0dXJuXG4gICAgXG4gICAgY29uc3Qga2V5ID0gdHJpbW1lZExpbmUuc3Vic3RyaW5nKDAsIGVxdWFsSW5kZXgpLnRyaW0oKVxuICAgIGNvbnN0IHZhbHVlID0gdHJpbW1lZExpbmUuc3Vic3RyaW5nKGVxdWFsSW5kZXggKyAxKS50cmltKClcbiAgICBjb25zdCBjbGVhblZhbHVlID0gdmFsdWUucmVwbGFjZSgvXltcIiddfFtcIiddJC9nLCAnJylcbiAgICBcbiAgICBpZiAoIXByb2Nlc3MuZW52W2tleV0pIHtcbiAgICAgIHByb2Nlc3MuZW52W2tleV0gPSBjbGVhblZhbHVlXG4gICAgfVxuICB9KVxufSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAvLyBTaWxlbnRseSBmYWlsIC0gZW52IHZhcnMgbWlnaHQgYWxyZWFkeSBiZSBsb2FkZWQgZnJvbSBuZXh0LmNvbmZpZy5tanNcbn1cblxuaW1wb3J0IE5leHRBdXRoIGZyb20gXCJuZXh0LWF1dGhcIlxuaW1wb3J0IEF6dXJlQURQcm92aWRlciBmcm9tIFwibmV4dC1hdXRoL3Byb3ZpZGVycy9henVyZS1hZFwiXG5pbXBvcnQgQ3JlZGVudGlhbHNQcm92aWRlciBmcm9tIFwibmV4dC1hdXRoL3Byb3ZpZGVycy9jcmVkZW50aWFsc1wiXG5pbXBvcnQgeyBBUElfQ09ORklHIH0gZnJvbSBcIkAvbGliL2NvbmZpZ1wiXG5cbi8qKlxuICogRW5zdXJlIHVzZXIgZXhpc3RzIGluIGRhdGFiYXNlIGJ5IGNhbGxpbmcgYmFja2VuZCBBUElcbiAqIEZyb250ZW5kIG5vIGxvbmdlciBjb25uZWN0cyBkaXJlY3RseSB0byBkYXRhYmFzZVxuICovXG5hc3luYyBmdW5jdGlvbiBlbnN1cmVVc2VyVXVpZEJ5RW1haWwoZW1haWw/OiBzdHJpbmcgfCBudWxsKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gICAgaWYgKCFlbWFpbCkgcmV0dXJuIG51bGxcblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7QVBJX0NPTkZJRy5iYXNlVXJsfS9hcGkvdXNlcnMvZW5zdXJlYCwge1xuICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVtYWlsIH0pLFxuICAgICAgICB9KVxuXG4gICAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYOKdjCBGYWlsZWQgdG8gZW5zdXJlIHVzZXI6IEhUVFAgJHtyZXNwb25zZS5zdGF0dXN9YClcbiAgICAgICAgICAgIHJldHVybiBudWxsXG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpXG4gICAgICAgIHJldHVybiBkYXRhLmlkIHx8IG51bGxcbiAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCLinYwgRXJyb3IgZW5zdXJpbmcgdXNlcjpcIiwgZXJyb3IpXG4gICAgICAgIHJldHVybiBudWxsXG4gICAgfVxufVxuXG4vLyBIZWxwZXIgxJHhu4MgdmFsaWRhdGUgR1VJRCBmb3JtYXRcbmZ1bmN0aW9uIGlzVmFsaWRHdWlkKHZhbHVlOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcbiAgICBpZiAoIXZhbHVlKSByZXR1cm4gZmFsc2VcbiAgICBjb25zdCBndWlkUmVnZXggPSAvXlswLTlhLWZdezh9LVswLTlhLWZdezR9LVsxLTVdWzAtOWEtZl17M30tWzg5YWJdWzAtOWEtZl17M30tWzAtOWEtZl17MTJ9JC9pXG4gICAgcmV0dXJuIGd1aWRSZWdleC50ZXN0KHZhbHVlKVxufVxuXG4vLyBDaOG7iSBlbmFibGUgQXp1cmUgQUQgcHJvdmlkZXIgbuG6v3UgY8OzIMSR4bunIGNvbmZpZyB2w6AgxJHDum5nIGZvcm1hdFxuY29uc3QgYXp1cmVBZENvbmZpZyA9IHtcbiAgICBjbGllbnRJZDogcHJvY2Vzcy5lbnYuQVpVUkVfQURfQ0xJRU5UX0lELFxuICAgIGNsaWVudFNlY3JldDogcHJvY2Vzcy5lbnYuQVpVUkVfQURfQ0xJRU5UX1NFQ1JFVCxcbiAgICB0ZW5hbnRJZDogcHJvY2Vzcy5lbnYuQVpVUkVfQURfVEVOQU5UX0lELFxufVxuXG5jb25zdCBwcm92aWRlcnM6IGFueVtdID0gW11cblxuLy8gQ2jhu4kgdGjDqm0gQXp1cmUgQUQgcHJvdmlkZXIgbuG6v3UgY8OzIMSR4bunIGNvbmZpZyB2w6AgxJHDum5nIGZvcm1hdFxuY29uc29sZS5sb2coXCLwn5SNIEF6dXJlIEFEIENvbmZpZyBDaGVjazpcIiwge1xuICAgIGhhc0NsaWVudElkOiAhIWF6dXJlQWRDb25maWcuY2xpZW50SWQsXG4gICAgaGFzQ2xpZW50U2VjcmV0OiAhIWF6dXJlQWRDb25maWcuY2xpZW50U2VjcmV0LFxuICAgIGhhc1RlbmFudElkOiAhIWF6dXJlQWRDb25maWcudGVuYW50SWQsXG4gICAgY2xpZW50SWRWYWxpZDogYXp1cmVBZENvbmZpZy5jbGllbnRJZCA/IGlzVmFsaWRHdWlkKGF6dXJlQWRDb25maWcuY2xpZW50SWQpIDogZmFsc2UsXG4gICAgdGVuYW50SWRWYWxpZDogYXp1cmVBZENvbmZpZy50ZW5hbnRJZCA/IGlzVmFsaWRHdWlkKGF6dXJlQWRDb25maWcudGVuYW50SWQpIDogZmFsc2UsXG4gICAgY2xpZW50SWRQcmV2aWV3OiBhenVyZUFkQ29uZmlnLmNsaWVudElkID8gYCR7YXp1cmVBZENvbmZpZy5jbGllbnRJZC5zdWJzdHJpbmcoMCwgOCl9Li4uYCA6IFwibWlzc2luZ1wiLFxuICAgIHRlbmFudElkUHJldmlldzogYXp1cmVBZENvbmZpZy50ZW5hbnRJZCA/IGAke2F6dXJlQWRDb25maWcudGVuYW50SWQuc3Vic3RyaW5nKDAsIDgpfS4uLmAgOiBcIm1pc3NpbmdcIixcbn0pXG5cbmlmIChcbiAgICBhenVyZUFkQ29uZmlnLmNsaWVudElkICYmXG4gICAgYXp1cmVBZENvbmZpZy5jbGllbnRTZWNyZXQgJiZcbiAgICBhenVyZUFkQ29uZmlnLnRlbmFudElkICYmXG4gICAgaXNWYWxpZEd1aWQoYXp1cmVBZENvbmZpZy5jbGllbnRJZCkgJiZcbiAgICBpc1ZhbGlkR3VpZChhenVyZUFkQ29uZmlnLnRlbmFudElkKVxuKSB7XG4gICAgcHJvdmlkZXJzLnB1c2goXG4gICAgICAgIEF6dXJlQURQcm92aWRlcih7XG4gICAgICAgICAgICBjbGllbnRJZDogYXp1cmVBZENvbmZpZy5jbGllbnRJZCxcbiAgICAgICAgICAgIGNsaWVudFNlY3JldDogYXp1cmVBZENvbmZpZy5jbGllbnRTZWNyZXQsXG4gICAgICAgICAgICB0ZW5hbnRJZDogYXp1cmVBZENvbmZpZy50ZW5hbnRJZCxcbiAgICAgICAgfSlcbiAgICApXG4gICAgY29uc29sZS5sb2coXCLinIUgQXp1cmUgQUQgcHJvdmlkZXIgZW5hYmxlZFwiKVxufSBlbHNlIHtcbiAgICBjb25zb2xlLndhcm4oXCLimqDvuI8gIEF6dXJlIEFEIHByb3ZpZGVyIGRpc2FibGVkIC0gbWlzc2luZyBvciBpbnZhbGlkIGNvbmZpZ3VyYXRpb25cIilcbiAgICBpZiAoIWF6dXJlQWRDb25maWcuY2xpZW50SWQpIHtcbiAgICAgICAgY29uc29sZS53YXJuKFwiICAg4p2MIE1pc3NpbmcgQVpVUkVfQURfQ0xJRU5UX0lEXCIpXG4gICAgfSBlbHNlIGlmICghaXNWYWxpZEd1aWQoYXp1cmVBZENvbmZpZy5jbGllbnRJZCkpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGAgICDinYwgSW52YWxpZCBBWlVSRV9BRF9DTElFTlRfSUQgZm9ybWF0OiAke2F6dXJlQWRDb25maWcuY2xpZW50SWR9YClcbiAgICAgICAgY29uc29sZS53YXJuKGAgICAgICBFeHBlY3RlZCBHVUlEIGZvcm1hdDogeHh4eHh4eHgteHh4eC14eHh4LXh4eHgteHh4eHh4eHh4eHh4YClcbiAgICB9XG4gICAgaWYgKCFhenVyZUFkQ29uZmlnLmNsaWVudFNlY3JldCkge1xuICAgICAgICBjb25zb2xlLndhcm4oXCIgICDinYwgTWlzc2luZyBBWlVSRV9BRF9DTElFTlRfU0VDUkVUXCIpXG4gICAgfVxuICAgIGlmICghYXp1cmVBZENvbmZpZy50ZW5hbnRJZCkge1xuICAgICAgICBjb25zb2xlLndhcm4oXCIgICDinYwgTWlzc2luZyBBWlVSRV9BRF9URU5BTlRfSURcIilcbiAgICB9IGVsc2UgaWYgKCFpc1ZhbGlkR3VpZChhenVyZUFkQ29uZmlnLnRlbmFudElkKSkge1xuICAgICAgICBjb25zb2xlLndhcm4oYCAgIOKdjCBJbnZhbGlkIEFaVVJFX0FEX1RFTkFOVF9JRCBmb3JtYXQ6ICR7YXp1cmVBZENvbmZpZy50ZW5hbnRJZH1gKVxuICAgICAgICBjb25zb2xlLndhcm4oYCAgICAgIEV4cGVjdGVkIEdVSUQgZm9ybWF0OiB4eHh4eHh4eC14eHh4LXh4eHgteHh4eC14eHh4eHh4eHh4eHhgKVxuICAgIH1cbn1cblxuY29uc3QgaGFuZGxlciA9IE5leHRBdXRoKHtcbiAgICAvLyBUcnVzdCBob3N0IMSR4buDIE5leHRBdXRoIHThu7EgZGV0ZWN0IG9yaWdpbiB04burIHJlcXVlc3QgaGVhZGVyc1xuICAgIC8vIMSQaeG7gXUgbsOgeSBnacO6cCB44butIGzDvSDEkcO6bmcga2hpIGNo4bqheSBxdWEgcHJveHkgaG/hurdjIGxvYWQgYmFsYW5jZXJcbiAgICB0cnVzdEhvc3Q6IHRydWUsXG4gICAgcHJvdmlkZXJzOiBbXG4gICAgICAgIC4uLnByb3ZpZGVycyxcbiAgICAgICAgQ3JlZGVudGlhbHNQcm92aWRlcih7XG4gICAgICAgICAgICBuYW1lOiBcIkNyZWRlbnRpYWxzXCIsXG4gICAgICAgICAgICBjcmVkZW50aWFsczoge1xuICAgICAgICAgICAgICAgIGVtYWlsOiB7IGxhYmVsOiBcIkVtYWlsXCIsIHR5cGU6IFwidGV4dFwiLCBwbGFjZWhvbGRlcjogXCJqc21pdGhAZXhhbXBsZS5jb21cIiB9LFxuICAgICAgICAgICAgICAgIHBhc3N3b3JkOiB7IGxhYmVsOiBcIlBhc3N3b3JkXCIsIHR5cGU6IFwicGFzc3dvcmRcIiB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFzeW5jIGF1dGhvcml6ZShjcmVkZW50aWFscywgcmVxKSB7XG4gICAgICAgICAgICAgICAgLy8gQWRkIHlvdXIgb3duIGxvZ2ljIGhlcmUgdG8gcmV0cmlldmUgYSB1c2VyIGZyb20gYSBkYXRhYmFzZVxuICAgICAgICAgICAgICAgIC8vIEZvciBkZW1vbnN0cmF0aW9uLCB3ZSdsbCB1c2UgYSBzaW1wbGUgaGFyZGNvZGVkIHVzZXJcbiAgICAgICAgICAgICAgICBpZiAoY3JlZGVudGlhbHM/LmVtYWlsID09PSBcInVzZXJAZXhhbXBsZS5jb21cIiAmJiBjcmVkZW50aWFscz8ucGFzc3dvcmQgPT09IFwicGFzc3dvcmQxMjNcIikge1xuICAgICAgICAgICAgICAgICAgICAvLyBBbnkgb2JqZWN0IHJldHVybmVkIHdpbGwgYmUgc2F2ZWQgaW4gYHVzZXJgIHByb3BlcnR5IG9mIHRoZSBKV1RcbiAgICAgICAgICAgICAgICAgICAgLy8gbOG6pXkvIHThuqFvIHV1aWQgdGhlbyBlbWFpbFxuICAgICAgICAgICAgICAgICAgICBjb25zdCB1aWQgPSBhd2FpdCBlbnN1cmVVc2VyVXVpZEJ5RW1haWwoY3JlZGVudGlhbHMuZW1haWwpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGlkOiB1aWQgPz8gXCIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDBcIiwgbmFtZTogXCJUZXN0IFVzZXJcIiwgZW1haWw6IGNyZWRlbnRpYWxzLmVtYWlsIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBJZiB5b3UgcmV0dXJuIG51bGwgdGhlbiBhbiBlcnJvciB3aWxsIGJlIGRpc3BsYXllZCBhZHZpc2luZyB0aGUgdXNlciB0aGV5IGFyZSB1bmFibGUgdG8gc2lnbiBpbi5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgICAgICAgICAgICAgICAgLy8gWW91IGNhbiBhbHNvIFJlamVjdCB0aGlzIGNhbGxiYWNrIHdpdGggYW4gRXJyb3IgdGh1cyB0aGUgdXNlciB3aWxsIGJlIHNlbnQgdG8gdGhlIGVycm9yIHBhZ2Ugd2l0aCB0aGUgZXJyb3IgbWVzc2FnZSBhcyBhIHF1ZXJ5IHBhcmFtZXRlclxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgIF0sXG4gICAgc2VjcmV0OiBwcm9jZXNzLmVudi5ORVhUQVVUSF9TRUNSRVQsXG4gICAgcGFnZXM6IHtcbiAgICAgICAgc2lnbkluOiBcIi9sb2dpblwiLCAvLyBSZWRpcmVjdCB0byB5b3VyIGN1c3RvbSBsb2dpbiBwYWdlXG4gICAgfSxcbiAgICBjYWxsYmFja3M6IHtcbiAgICAgICAgYXN5bmMgand0KHsgdG9rZW4sIHVzZXIsIGFjY291bnQsIHByb2ZpbGUgfSkge1xuICAgICAgICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgICAgICAgICAvLyBO4bq/dSBsw6AgQ3JlZGVudGlhbHNQcm92aWRlciDihpIgdXNlci5pZCDEkcOjIGPDsyBz4bq1blxuICAgICAgICAgICAgICAgIC8vIE7hur91IGzDoCBBenVyZUFEIOKGkiBj4bqnbiB04bqhby8gbOG6pXkgdXVpZFxuICAgICAgICAgICAgICAgIGNvbnN0IHVpZCA9IGF3YWl0IGVuc3VyZVVzZXJVdWlkQnlFbWFpbCh1c2VyLmVtYWlsKVxuICAgICAgICAgICAgICAgIHRva2VuLmlkID0gdWlkID8/IFwiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwXCJcbiAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB0b2tlbi5wcm92aWRlciA9IGFjY291bnQ/LnByb3ZpZGVyID8/IHRva2VuLnByb3ZpZGVyXG4gICAgICAgICAgICAgICAgdG9rZW4ucHJvZmlsZSA9IHByb2ZpbGUgPz8gdG9rZW4ucHJvZmlsZVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYWNjb3VudD8uYWNjZXNzX3Rva2VuKSB0b2tlbi5hY2Nlc3NUb2tlbiA9IGFjY291bnQuYWNjZXNzX3Rva2VuXG4gICAgICAgICAgICByZXR1cm4gdG9rZW5cbiAgICAgICAgfSxcbiAgICAgICAgYXN5bmMgc2Vzc2lvbih7IHNlc3Npb24sIHRva2VuIH0pIHtcbiAgICAgICAgICAgIC8vIFNlbmQgcHJvcGVydGllcyB0byB0aGUgY2xpZW50LCBzdWNoIGFzIGFuIGFjY2Vzc190b2tlbiBmcm9tIGEgcHJvdmlkZXIuXG4gICAgICAgICAgICBzZXNzaW9uLmFjY2Vzc1Rva2VuID0gdG9rZW4uYWNjZXNzVG9rZW4gYXMgc3RyaW5nXG4gICAgICAgICAgICBzZXNzaW9uLnVzZXIuaWQgPSB0b2tlbi5pZCBhcyBzdHJpbmdcbiAgICAgICAgICAgIHNlc3Npb24udXNlci5wcm9maWxlID0gdG9rZW4ucHJvZmlsZSAvLyBBZGQgcHJvZmlsZSB0byBzZXNzaW9uXG4gICAgICAgICAgICBzZXNzaW9uLnVzZXIucHJvdmlkZXIgPSB0b2tlbi5wcm92aWRlciBhcyBzdHJpbmcgLy8gQWRkIHByb3ZpZGVyIHRvIHNlc3Npb25cbiAgICAgICAgICAgIHNlc3Npb24udXNlci5pbWFnZSA9IHRva2VuLnBpY3R1cmUgfHwgc2Vzc2lvbi51c2VyLmltYWdlIHx8IG51bGxcbiAgICAgICAgICAgIHJldHVybiBzZXNzaW9uXG4gICAgICAgIH0sXG4gICAgICAgIGFzeW5jIHJlZGlyZWN0KHsgdXJsLCBiYXNlVXJsIH0pIHtcbiAgICAgICAgICAgIC8vIMavdSB0acOqbiBz4butIGThu6VuZyBiYXNlVXJsIHThu6sgTmV4dEF1dGggKMSRxrDhu6NjIGRldGVjdCB04burIHJlcXVlc3QgaGVhZGVycylcbiAgICAgICAgICAgIC8vIE7hur91IGtow7RuZyBjw7MsIGZhbGxiYWNrIHbhu4EgTkVYVEFVVEhfVVJMIGVudiB2YXJpYWJsZVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBO4bq/dSB1cmwgbMOgIHJlbGF0aXZlIHBhdGggKGLhuq90IMSR4bqndSBi4bqxbmcgLylcbiAgICAgICAgICAgIGlmICh1cmwuc3RhcnRzV2l0aChcIi9cIikpIHtcbiAgICAgICAgICAgICAgICAvLyBT4butIGThu6VuZyBiYXNlVXJsIHThu6sgTmV4dEF1dGggKMSRw6MgxJHGsOG7o2MgZGV0ZWN0IHThu6sgcmVxdWVzdClcbiAgICAgICAgICAgICAgICAvLyBiYXNlVXJsIHPhur0gbMOgIG9yaWdpbiBj4bunYSByZXF1ZXN0IGhp4buHbiB04bqhaSAobG9jYWxob3N0OjMwMDAgaG/hurdjIHJlc2VhcmNoLm5ldS5lZHUudm4pXG4gICAgICAgICAgICAgICAgcmV0dXJuIGAke2Jhc2VVcmx9JHt1cmx9YFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBO4bq/dSB1cmwgbMOgIGFic29sdXRlIFVSTFxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB1cmxPYmogPSBuZXcgVVJMKHVybClcbiAgICAgICAgICAgICAgICBjb25zdCBiYXNlVXJsT2JqID0gbmV3IFVSTChiYXNlVXJsKVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIE7hur91IGPDuW5nIG9yaWdpbiB24bubaSBiYXNlVXJsIC0+IGNobyBwaMOpcFxuICAgICAgICAgICAgICAgIGlmICh1cmxPYmoub3JpZ2luID09PSBiYXNlVXJsT2JqLm9yaWdpbikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdXJsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIE7hur91IGtow6FjIG9yaWdpbiAtPiByZWRpcmVjdCB24buBIGJhc2VVcmwgduG7m2kgcGF0aCB04burIHVybFxuICAgICAgICAgICAgICAgIHJldHVybiBgJHtiYXNlVXJsfSR7dXJsT2JqLnBhdGhuYW1lfSR7dXJsT2JqLnNlYXJjaH1gXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIC8vIE7hur91IGPDsyBs4buXaSBwYXJzZSBVUkwsIGZhbGxiYWNrIHbhu4EgdHJhbmcgY2jhu6cgY+G7p2EgYmFzZVVybFxuICAgICAgICAgICAgICAgIHJldHVybiBgJHtiYXNlVXJsfS9hc3Npc3RhbnRzL21haW5gXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgfSxcbn0pXG5cbmV4cG9ydCB7IGhhbmRsZXIgYXMgR0VULCBoYW5kbGVyIGFzIFBPU1QgfVxuIl0sIm5hbWVzIjpbInJlYWRGaWxlU3luYyIsInJlc29sdmUiLCJlbnZQYXRoIiwicHJvY2VzcyIsImN3ZCIsImVudkZpbGUiLCJlbnZMaW5lcyIsInNwbGl0IiwiZm9yRWFjaCIsImxpbmUiLCJ0cmltbWVkTGluZSIsInRyaW0iLCJzdGFydHNXaXRoIiwiZXF1YWxJbmRleCIsImluZGV4T2YiLCJrZXkiLCJzdWJzdHJpbmciLCJ2YWx1ZSIsImNsZWFuVmFsdWUiLCJyZXBsYWNlIiwiZW52IiwiZXJyb3IiLCJOZXh0QXV0aCIsIkF6dXJlQURQcm92aWRlciIsIkNyZWRlbnRpYWxzUHJvdmlkZXIiLCJBUElfQ09ORklHIiwiZW5zdXJlVXNlclV1aWRCeUVtYWlsIiwiZW1haWwiLCJyZXNwb25zZSIsImZldGNoIiwiYmFzZVVybCIsIm1ldGhvZCIsImhlYWRlcnMiLCJib2R5IiwiSlNPTiIsInN0cmluZ2lmeSIsIm9rIiwiY29uc29sZSIsInN0YXR1cyIsImRhdGEiLCJqc29uIiwiaWQiLCJpc1ZhbGlkR3VpZCIsImd1aWRSZWdleCIsInRlc3QiLCJhenVyZUFkQ29uZmlnIiwiY2xpZW50SWQiLCJBWlVSRV9BRF9DTElFTlRfSUQiLCJjbGllbnRTZWNyZXQiLCJBWlVSRV9BRF9DTElFTlRfU0VDUkVUIiwidGVuYW50SWQiLCJBWlVSRV9BRF9URU5BTlRfSUQiLCJwcm92aWRlcnMiLCJsb2ciLCJoYXNDbGllbnRJZCIsImhhc0NsaWVudFNlY3JldCIsImhhc1RlbmFudElkIiwiY2xpZW50SWRWYWxpZCIsInRlbmFudElkVmFsaWQiLCJjbGllbnRJZFByZXZpZXciLCJ0ZW5hbnRJZFByZXZpZXciLCJwdXNoIiwid2FybiIsImhhbmRsZXIiLCJ0cnVzdEhvc3QiLCJuYW1lIiwiY3JlZGVudGlhbHMiLCJsYWJlbCIsInR5cGUiLCJwbGFjZWhvbGRlciIsInBhc3N3b3JkIiwiYXV0aG9yaXplIiwicmVxIiwidWlkIiwic2VjcmV0IiwiTkVYVEFVVEhfU0VDUkVUIiwicGFnZXMiLCJzaWduSW4iLCJjYWxsYmFja3MiLCJqd3QiLCJ0b2tlbiIsInVzZXIiLCJhY2NvdW50IiwicHJvZmlsZSIsInByb3ZpZGVyIiwiYWNjZXNzX3Rva2VuIiwiYWNjZXNzVG9rZW4iLCJzZXNzaW9uIiwiaW1hZ2UiLCJwaWN0dXJlIiwicmVkaXJlY3QiLCJ1cmwiLCJ1cmxPYmoiLCJVUkwiLCJiYXNlVXJsT2JqIiwib3JpZ2luIiwicGF0aG5hbWUiLCJzZWFyY2giLCJHRVQiLCJQT1NUIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./app/api/auth/[...nextauth]/route.ts\n");

/***/ }),

/***/ "(rsc)/./lib/config.ts":
/*!***********************!*\
  !*** ./lib/config.ts ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   API_CONFIG: () => (/* binding */ API_CONFIG)\n/* harmony export */ });\n// lib/config.ts\nconst API_CONFIG = {\n    baseUrl:  false ? 0 // Client-side: use backend URL\n     : \"http://localhost:3001\" || 0 || 0\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9saWIvY29uZmlnLnRzIiwibWFwcGluZ3MiOiI7Ozs7QUFBQSxnQkFBZ0I7QUFDVCxNQUFNQSxhQUFhO0lBQ3RCQyxTQUNJLE1BQTZCLEdBQ3RCQyxDQUErRCxDQUFHLCtCQUErQjtPQUNqR0EsdUJBQW9DLElBQ3BDQSxDQUF1QixJQUN2QixDQUF1QjtBQUN0QyxFQUFDIiwic291cmNlcyI6WyIvVXNlcnMvbWFjL0N1cnNvci9SZXNlYXJjaC9mcm9udGVuZC9saWIvY29uZmlnLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIGxpYi9jb25maWcudHNcbmV4cG9ydCBjb25zdCBBUElfQ09ORklHID0ge1xuICAgIGJhc2VVcmw6XG4gICAgICAgIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnIFxuICAgICAgICAgICAgPyAocHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfQVBJX0JBU0VfVVJMIHx8IFwiaHR0cDovL2xvY2FsaG9zdDozMDAxXCIpICAvLyBDbGllbnQtc2lkZTogdXNlIGJhY2tlbmQgVVJMXG4gICAgICAgICAgICA6IChwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19BUElfQkFTRV9VUkwgfHwgXG4gICAgICAgICAgICAgICBwcm9jZXNzLmVudi5CQUNLRU5EX1VSTCB8fCBcbiAgICAgICAgICAgICAgIFwiaHR0cDovL2xvY2FsaG9zdDozMDAxXCIpLCAvLyBTZXJ2ZXItc2lkZTogdXNlIGJhY2tlbmQgVVJMXG59XG4iXSwibmFtZXMiOlsiQVBJX0NPTkZJRyIsImJhc2VVcmwiLCJwcm9jZXNzIiwiZW52IiwiTkVYVF9QVUJMSUNfQVBJX0JBU0VfVVJMIiwiQkFDS0VORF9VUkwiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./lib/config.ts\n");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&page=%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute.ts&appDir=%2FUsers%2Fmac%2FCursor%2FResearch%2Ffrontend%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fmac%2FCursor%2FResearch%2Ffrontend&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=standalone&preferredRegion=&middlewareConfig=e30%3D!":
/*!**************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&page=%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute.ts&appDir=%2FUsers%2Fmac%2FCursor%2FResearch%2Ffrontend%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fmac%2FCursor%2FResearch%2Ffrontend&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=standalone&preferredRegion=&middlewareConfig=e30%3D! ***!
  \**************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   workAsyncStorage: () => (/* binding */ workAsyncStorage),\n/* harmony export */   workUnitAsyncStorage: () => (/* binding */ workUnitAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/route-kind */ \"(rsc)/./node_modules/next/dist/server/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _Users_mac_Cursor_Research_frontend_app_api_auth_nextauth_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./app/api/auth/[...nextauth]/route.ts */ \"(rsc)/./app/api/auth/[...nextauth]/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"standalone\"\nconst routeModule = new next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/auth/[...nextauth]/route\",\n        pathname: \"/api/auth/[...nextauth]\",\n        filename: \"route\",\n        bundlePath: \"app/api/auth/[...nextauth]/route\"\n    },\n    resolvedPagePath: \"/Users/mac/Cursor/Research/frontend/app/api/auth/[...nextauth]/route.ts\",\n    nextConfigOutput,\n    userland: _Users_mac_Cursor_Research_frontend_app_api_auth_nextauth_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { workAsyncStorage, workUnitAsyncStorage, serverHooks } = routeModule;\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        workAsyncStorage,\n        workUnitAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIvaW5kZXguanM/bmFtZT1hcHAlMkZhcGklMkZhdXRoJTJGJTVCLi4ubmV4dGF1dGglNUQlMkZyb3V0ZSZwYWdlPSUyRmFwaSUyRmF1dGglMkYlNUIuLi5uZXh0YXV0aCU1RCUyRnJvdXRlJmFwcFBhdGhzPSZwYWdlUGF0aD1wcml2YXRlLW5leHQtYXBwLWRpciUyRmFwaSUyRmF1dGglMkYlNUIuLi5uZXh0YXV0aCU1RCUyRnJvdXRlLnRzJmFwcERpcj0lMkZVc2VycyUyRm1hYyUyRkN1cnNvciUyRlJlc2VhcmNoJTJGZnJvbnRlbmQlMkZhcHAmcGFnZUV4dGVuc2lvbnM9dHN4JnBhZ2VFeHRlbnNpb25zPXRzJnBhZ2VFeHRlbnNpb25zPWpzeCZwYWdlRXh0ZW5zaW9ucz1qcyZyb290RGlyPSUyRlVzZXJzJTJGbWFjJTJGQ3Vyc29yJTJGUmVzZWFyY2glMkZmcm9udGVuZCZpc0Rldj10cnVlJnRzY29uZmlnUGF0aD10c2NvbmZpZy5qc29uJmJhc2VQYXRoPSZhc3NldFByZWZpeD0mbmV4dENvbmZpZ091dHB1dD1zdGFuZGFsb25lJnByZWZlcnJlZFJlZ2lvbj0mbWlkZGxld2FyZUNvbmZpZz1lMzAlM0QhIiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBQStGO0FBQ3ZDO0FBQ3FCO0FBQ3VCO0FBQ3BHO0FBQ0E7QUFDQTtBQUNBLHdCQUF3Qix5R0FBbUI7QUFDM0M7QUFDQSxjQUFjLGtFQUFTO0FBQ3ZCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQSxZQUFZO0FBQ1osQ0FBQztBQUNEO0FBQ0E7QUFDQTtBQUNBLFFBQVEsc0RBQXNEO0FBQzlEO0FBQ0EsV0FBVyw0RUFBVztBQUN0QjtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQzBGOztBQUUxRiIsInNvdXJjZXMiOlsiIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwcFJvdXRlUm91dGVNb2R1bGUgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9yb3V0ZS1tb2R1bGVzL2FwcC1yb3V0ZS9tb2R1bGUuY29tcGlsZWRcIjtcbmltcG9ydCB7IFJvdXRlS2luZCB9IGZyb20gXCJuZXh0L2Rpc3Qvc2VydmVyL3JvdXRlLWtpbmRcIjtcbmltcG9ydCB7IHBhdGNoRmV0Y2ggYXMgX3BhdGNoRmV0Y2ggfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9saWIvcGF0Y2gtZmV0Y2hcIjtcbmltcG9ydCAqIGFzIHVzZXJsYW5kIGZyb20gXCIvVXNlcnMvbWFjL0N1cnNvci9SZXNlYXJjaC9mcm9udGVuZC9hcHAvYXBpL2F1dGgvWy4uLm5leHRhdXRoXS9yb3V0ZS50c1wiO1xuLy8gV2UgaW5qZWN0IHRoZSBuZXh0Q29uZmlnT3V0cHV0IGhlcmUgc28gdGhhdCB3ZSBjYW4gdXNlIHRoZW0gaW4gdGhlIHJvdXRlXG4vLyBtb2R1bGUuXG5jb25zdCBuZXh0Q29uZmlnT3V0cHV0ID0gXCJzdGFuZGFsb25lXCJcbmNvbnN0IHJvdXRlTW9kdWxlID0gbmV3IEFwcFJvdXRlUm91dGVNb2R1bGUoe1xuICAgIGRlZmluaXRpb246IHtcbiAgICAgICAga2luZDogUm91dGVLaW5kLkFQUF9ST1VURSxcbiAgICAgICAgcGFnZTogXCIvYXBpL2F1dGgvWy4uLm5leHRhdXRoXS9yb3V0ZVwiLFxuICAgICAgICBwYXRobmFtZTogXCIvYXBpL2F1dGgvWy4uLm5leHRhdXRoXVwiLFxuICAgICAgICBmaWxlbmFtZTogXCJyb3V0ZVwiLFxuICAgICAgICBidW5kbGVQYXRoOiBcImFwcC9hcGkvYXV0aC9bLi4ubmV4dGF1dGhdL3JvdXRlXCJcbiAgICB9LFxuICAgIHJlc29sdmVkUGFnZVBhdGg6IFwiL1VzZXJzL21hYy9DdXJzb3IvUmVzZWFyY2gvZnJvbnRlbmQvYXBwL2FwaS9hdXRoL1suLi5uZXh0YXV0aF0vcm91dGUudHNcIixcbiAgICBuZXh0Q29uZmlnT3V0cHV0LFxuICAgIHVzZXJsYW5kXG59KTtcbi8vIFB1bGwgb3V0IHRoZSBleHBvcnRzIHRoYXQgd2UgbmVlZCB0byBleHBvc2UgZnJvbSB0aGUgbW9kdWxlLiBUaGlzIHNob3VsZFxuLy8gYmUgZWxpbWluYXRlZCB3aGVuIHdlJ3ZlIG1vdmVkIHRoZSBvdGhlciByb3V0ZXMgdG8gdGhlIG5ldyBmb3JtYXQuIFRoZXNlXG4vLyBhcmUgdXNlZCB0byBob29rIGludG8gdGhlIHJvdXRlLlxuY29uc3QgeyB3b3JrQXN5bmNTdG9yYWdlLCB3b3JrVW5pdEFzeW5jU3RvcmFnZSwgc2VydmVySG9va3MgfSA9IHJvdXRlTW9kdWxlO1xuZnVuY3Rpb24gcGF0Y2hGZXRjaCgpIHtcbiAgICByZXR1cm4gX3BhdGNoRmV0Y2goe1xuICAgICAgICB3b3JrQXN5bmNTdG9yYWdlLFxuICAgICAgICB3b3JrVW5pdEFzeW5jU3RvcmFnZVxuICAgIH0pO1xufVxuZXhwb3J0IHsgcm91dGVNb2R1bGUsIHdvcmtBc3luY1N0b3JhZ2UsIHdvcmtVbml0QXN5bmNTdG9yYWdlLCBzZXJ2ZXJIb29rcywgcGF0Y2hGZXRjaCwgIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWFwcC1yb3V0ZS5qcy5tYXAiXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&page=%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute.ts&appDir=%2FUsers%2Fmac%2FCursor%2FResearch%2Ffrontend%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fmac%2FCursor%2FResearch%2Ffrontend&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=standalone&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!******************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \******************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "(ssr)/./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!******************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \******************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "../app-render/after-task-async-storage.external":
/*!***********************************************************************************!*\
  !*** external "next/dist/server/app-render/after-task-async-storage.external.js" ***!
  \***********************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/after-task-async-storage.external.js");

/***/ }),

/***/ "../app-render/work-async-storage.external":
/*!*****************************************************************************!*\
  !*** external "next/dist/server/app-render/work-async-storage.external.js" ***!
  \*****************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-async-storage.external.js");

/***/ }),

/***/ "./work-unit-async-storage.external":
/*!**********************************************************************************!*\
  !*** external "next/dist/server/app-render/work-unit-async-storage.external.js" ***!
  \**********************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-unit-async-storage.external.js");

/***/ }),

/***/ "assert":
/*!*************************!*\
  !*** external "assert" ***!
  \*************************/
/***/ ((module) => {

"use strict";
module.exports = require("assert");

/***/ }),

/***/ "buffer":
/*!*************************!*\
  !*** external "buffer" ***!
  \*************************/
/***/ ((module) => {

"use strict";
module.exports = require("buffer");

/***/ }),

/***/ "crypto":
/*!*************************!*\
  !*** external "crypto" ***!
  \*************************/
/***/ ((module) => {

"use strict";
module.exports = require("crypto");

/***/ }),

/***/ "events":
/*!*************************!*\
  !*** external "events" ***!
  \*************************/
/***/ ((module) => {

"use strict";
module.exports = require("events");

/***/ }),

/***/ "fs":
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ "http":
/*!***********************!*\
  !*** external "http" ***!
  \***********************/
/***/ ((module) => {

"use strict";
module.exports = require("http");

/***/ }),

/***/ "https":
/*!************************!*\
  !*** external "https" ***!
  \************************/
/***/ ((module) => {

"use strict";
module.exports = require("https");

/***/ }),

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/***/ ((module) => {

"use strict";
module.exports = require("path");

/***/ }),

/***/ "querystring":
/*!******************************!*\
  !*** external "querystring" ***!
  \******************************/
/***/ ((module) => {

"use strict";
module.exports = require("querystring");

/***/ }),

/***/ "url":
/*!**********************!*\
  !*** external "url" ***!
  \**********************/
/***/ ((module) => {

"use strict";
module.exports = require("url");

/***/ }),

/***/ "util":
/*!***********************!*\
  !*** external "util" ***!
  \***********************/
/***/ ((module) => {

"use strict";
module.exports = require("util");

/***/ }),

/***/ "zlib":
/*!***********************!*\
  !*** external "zlib" ***!
  \***********************/
/***/ ((module) => {

"use strict";
module.exports = require("zlib");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/jose","vendor-chunks/next","vendor-chunks/next-auth","vendor-chunks/openid-client","vendor-chunks/@babel","vendor-chunks/uuid","vendor-chunks/oauth","vendor-chunks/@panva","vendor-chunks/yallist","vendor-chunks/preact-render-to-string","vendor-chunks/preact","vendor-chunks/oidc-token-hash","vendor-chunks/object-hash","vendor-chunks/lru-cache","vendor-chunks/cookie"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&page=%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute.ts&appDir=%2FUsers%2Fmac%2FCursor%2FResearch%2Ffrontend%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fmac%2FCursor%2FResearch%2Ffrontend&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=standalone&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();