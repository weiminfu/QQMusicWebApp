let musicRender = (function () {
    let $headerBox=$('.headerBox');
    let $contentBox=$('.contentBox');
    let $footerBox=$('.footerBox');
    let $wrapper=$contentBox.find('.wrapper');
    let $lyricList=null;
    let musicAudio=$('#musicAudio')[0];
    let $playBtn=$headerBox.find('.playBtn');
    let $already=$footerBox.find('.already');
    let $duration=$footerBox.find('.duration');
    let $current=$footerBox.find('.current');

    //=>计算content区域的高度
    let computedContent=function computedContent() {
        let winH=document.documentElement.clientHeight;
        let font=parseFloat(document.documentElement.style.fontSize);
        $contentBox.css({
            height:winH-$headerBox[0].offsetHeight-$footerBox[0].offsetHeight-.8*font
        });
    };

    //=>获取歌词
    let queryLyric=function queryLyric() {
        return new Promise(resolve => {
            $.ajax({
                url:'json/hellotomorrowLyric.json',
                method:'get',
                success:resolve
            })
        })
    };

    //=>绑定歌词
    let bindHTML=function bindHTML(lyricAry) {
        let str=``;
        lyricAry.forEach((item)=>{
            let {minutes,seconds,content}=item;
            str+=`<p data-minutes="${minutes}" data-seconds="${seconds}">${content}</p>`;//数据绑定的时候把歌词对应的分、秒预先挂载到自定义属性上，后期需要直接获取即可
        });
        $wrapper.html(str);
        $lyricList=$wrapper.find('p');
    };

    //=>开始播放
    let $plan=$.Callbacks();//=>发布订阅设计模式：准备一个计划（事件池子）
    let playRun=function playRun() {
        musicAudio.play();
        musicAudio.addEventListener('canplay', $plan.fire);//=>能够播放了，通知事件池中的方法执行
    };

    //=>控制暂停、播放按钮
    $plan.add(()=>{
        $playBtn.css('display','block').addClass('move');
        $playBtn.tap(()=>{
            if(musicAudio.paused){
                //=>是否为暂停状态：是暂停我们让其播放
                musicAudio.play();
                $playBtn.addClass('move');
            }else {
                //=>当前是播放的状态我们让其暂停
                musicAudio.pause();
                $playBtn.removeClass('move');
            }
        });
    });

    //=>控制进度条（能播放的时候做的：发布订阅）
    let autoTimer=null;
    $plan.add(()=>{
        let duration=musicAudio.duration;//获取的总时间是秒
        $duration.html(computedTime(duration));

        //=>随时监听播放的时间长度：每隔一秒
        autoTimer=setInterval(()=>{
            let currentTime=musicAudio.currentTime;
            if (currentTime>=duration) {
                //=>播放完成清定时器
                clearInterval(autoTimer);
                //=>播放完成的终态设置：
                $already.html(computedTime(duration));
                $current.css('width','100%');

                musicAudio.pause();
                $playBtn.removeClass('move');

                return;//后续代码不执行
            }
            //=>正在播放中
            $already.html(computedTime(currentTime));
            $current.css('width',currentTime/duration*100+'%');
            matchLyric(currentTime);
        },1000)
    });

    //=>时间格式转换
    let computedTime=function computedTime(time) {
        //=>time：秒
        let minutes=Math.floor(time/60);//Math.floor();向下取整，得分钟
        let seconds=Math.floor(time-minutes*60);
        //补零
        minutes < 10 ? minutes = '0'+minutes : null;
        seconds < 10 ? seconds = '0'+seconds : null;

        //=>返回拼接好的字符串格式
        return `${minutes}:${seconds}`;
    };

    //=>matchLyric 匹配歌词，实现歌词对应
    let translateY=0;
    let matchLyric=function matchLyric(currentTime) {
        //=>currentTime：已经播放的时间（通过computedTime()方法得到xx:xx格式，通过拆分获取对应的分钟和秒数）
        let [minutes, seconds]=computedTime(currentTime).split(':');//split()方法通过冒号拆分成数组

        //=>在歌词集合中找到当前播放的对应歌词
        //JQ中的find、children、filter方法都是通过选择器筛选的
        let $cur=$lyricList.filter(`[data-minutes="${minutes}"]`).filter(`[data-seconds="${seconds}"]`);

        if ($cur.length===0) return;//没有找到则返回，不执行下面的代码了

        if ($cur.hasClass('active')) return;//说明当前歌词已经被选中了（例如：这句歌词可能需要5秒才能播放完成，我们定时器监听了五次，第一次设置后，后面四次不需要设置了）
        
        let index=$cur.index();
        $cur.addClass('active').siblings().removeClass('active');//歌词具有被选中的样式
        if (index>=4){
            //已经对应超过四条歌词了，接下来没对应一条歌词，都让歌词容器wrapper向上移动一行歌词的高度
            let curH=$cur[0].offsetHeight;
            translateY-=curH;
            $wrapper.css('transform',`translateY(${translateY}px)`);
        }
    };


    return {
        init: function init() {
            computedContent();
            let promise=queryLyric();
            promise.then(result=>{//result是获取的数据
                //=>format-data 格式化数据：去掉歌词中的特殊内容
                let {lyric=''}=result;
                let obj={32:' ', 40:'(', 41:')', 45:'-'};
                let reg=/&#(\d+);/g;
                lyric=lyric.replace(reg,(...arg)=>{
                    //=>捕获的结果  &#32； 32
                    let [item,num]=arg;
                    /*
                    switch (parseFloat(num)) {//正则捕获的num是字符串，要转换为数字
                        case 32:
                            item=' ';//替换为空格
                            break;
                        case 40:
                            item='(';
                            break;
                        case 41:
                            item=')';
                            break;
                        case 45:
                            item='-';
                            break;
                    }
                    */
                    //=>上面的switch转换为更简单的写法：
                    item=obj[num] || item;
                    return item;
                });
                // console.log(lyric);//文字中间的特殊符号被替换掉了
                return lyric;//上一个then执行的返回结果会传给下一个then
            })
                .then(lyric=>{
                //lyric：上一次处理好的结果
                //=>format-data 数据格式化：把歌词对应的分钟、秒、歌词内容等信息依次存储起来
                lyric+='&#10;';//向歌词末尾直接加结束符
                let lyricAry=[];
                let reg=/\[(\d+)&#58;(\d+)&#46;\d+\]([^&#]+)&#10;/g;//分组分别是分、秒、歌词内容，第三个分组是非&符和#
                lyric.replace(reg,(...arg)=>{//arg是捕获到的内容，是一个数组
                    let [,minutes,seconds,content]=arg;//第一个是大正则捕获的不要，后面的是小分组捕获的内容
                    lyricAry.push({
                        minutes,
                        seconds,
                        content
                    });
                });
                // console.log(lyricAry);//得一个数组
                return lyricAry;
            })
                .then(bindHTML)
                .then(playRun);
        }
    }
})();
musicRender.init();