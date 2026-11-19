// p5.brush регистрирует свои хуки (push/pop, randomSeed, сброс композиции в
// конце draw) только если p5 доступен глобально в момент загрузки модуля.
// Этот модуль импортируется первым и выставляет window.p5.
import p5 from "p5";
window.p5 = p5;
export default p5;
