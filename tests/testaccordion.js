
// Create new YUI instance, and populate it with the required modules
YUI( {
    combine: false, 
    debug: true, 
    filter:"RAW",
    modules: {
        'accordion': {
			type: 'js',
			fullpath: '../build/accordion/accordion.js',
            requires: [ 'widget-stdmod', 'anim-easing', 'dd-constrain', 'dd-proxy', 'dd-drop', 'event-delegate' ]
        },
		'accordion-css' : {
			type: 'css',
			fullpath: '../build/accordion/assets/skins/sam/accordion.css'
		}
    }
} ).use("accordion", 'accordion-css', 'test', 'console', 'event-simulate', function(Y) {
    
    var _that = this;

    /**
     * Create an Accordion from markup, animation enabled.
     * Accordion's content box already has two items, which will be added to accordion authomatically 
     */
    
    this._accordion = new Y.Accordion( {
        contentBox: "#acc1",
        useAnimation: true,
        collapseOthersOnExpand: true
    });

    /**
     * Set some params just before adding items in the accordion
     */
    this._accordion.on( "beforeItemAdd", function( _attrs ){
        var _item, _id;
        
        _item = _attrs.item;
        _id = _item.get( "contentBox" ).get( "id" );

        if( _id === "item2" ){
            _item.set( "label", "Label2" ); // there is no label in markup for this item, so we set it here
        } else if( _id === "item3" ){
            _item.set( "label", "Label3, overwritten" ); // we overwrite the label from markup
        }
    }, this );

    
    var testBuildFromMarkup = new Y.Test.Case({
                    
        name: "Test accordion, build from markup",
        
        testItemsCount: function(){
            var _items = _that._accordion.get( "items" );
            Y.Assert.areEqual( 4, _items.length, "Accordion must have 4 items");
        },
        
        testItemsExpandedStatus: function(){
            var _items, _expanded0, _expanded1, _expanded2, _expanded3,
                _item0, _item1, _item2, _item3;
                
            _items = _that._accordion.get( "items" );
            
            _item0 = _items[0];
            _item1 = _items[1];
            _item2 = _items[2];
            _item3 = _items[3];
            
            _expanded0 = _item0.get( "expanded" );
            _expanded1 = _item1.get( "expanded" );
            _expanded2 = _item2.get( "expanded" );
            _expanded3 = _item3.get( "expanded" );
            
            
            Y.Assert.areSame( true, _expanded0, "Item 0 must be expanded");
            Y.Assert.areSame( true, _expanded1, "Item 1 must be expanded");
            Y.Assert.areSame( true, _expanded2, "Item 2 must be expanded");
            Y.Assert.areSame( true, _expanded3, "Item 3 must be expanded");
        },
        
        testItemsAlwaysVisibleStatus: function(){
            var _items, _av1, _av2, _av3, _av4,
                _item1, _item2, _item3, _item4;
                
            _items = _that._accordion.get( "items" );
            
            _item1 = _items[0];
            _item2 = _items[1];
            _item3 = _items[2];
            _item4 = _items[3];
            
            _av1 = _item1.get( "alwaysVisible" );
            _av2 = _item2.get( "alwaysVisible" );
            _av3 = _item3.get( "alwaysVisible" );
            _av4 = _item4.get( "alwaysVisible" );
            
            
            Y.Assert.areSame( true, _av1 , "Item 1 must be always visible");
            Y.Assert.areSame( true, _av2 , "Item 2 must be always visible");
            Y.Assert.areSame( false, _av3 , "Item 3 must be not always visible");
            Y.Assert.areSame( true, _av4 , "Item 4 must be always visible");
        },
        
        testManuallySwitchingAttrs: function(){
            var _items, _item1, _item3;
                
            _items = _that._accordion.get( "items" );
            
            _item1 = _items[0];
            _item3 = _items[2];
            
            _item1.set( "expanded", false );
            Y.Assert.areSame( false, _item1.get( "alwaysVisible" ), "After collapsing, alwaysvisible must be false also");
            
            this.wait(function(){
                _item1.set( "alwaysVisible", true );
                
                Y.Assert.areSame( true, _item1.get( "alwaysVisible" ), "Always visible must be true");
                Y.Assert.areSame( true, _item1.get( "expanded" ), "Expanded must be true");
                Y.Assert.areSame( false, _item3.get( "expanded" ), "Item3 - expanded also must be false");
                
                
                _item3.set( "alwaysVisisble", false ); // nothing to do
                Y.Assert.areSame( false, _item3.get( "alwaysVisible" ), "alwaysVisible must be false");
                Y.Assert.areSame( false, _item3.get( "expanded" ), "expanded must be false");

            }, 1000);
        },
            
        testManuallySwitchingAttrs2: function(){
            var _items, _item2;
                
            _items = _that._accordion.get( "items" );
            
            _item2 = _items[1];
            
            _item2.set( "alwaysVisible", false );
            Y.Assert.areSame( false, _item2.get( "alwaysVisible" ), "alwaysvisible must be false");
            Y.Assert.areSame( true, _item2.get( "expanded" ), "expanded must be true");
        },
        
        
        testExpandedFalse: function(){
            var _items, _item2;
                
            _items = _that._accordion.get( "items" );
            
            _item2 = _items[2];
            
            _item2.set( "alwaysVisible", true );
            Y.Assert.areSame( true, _item2.get( "alwaysVisible" ), "alwaysvisible must be true");
            Y.Assert.areSame( true, _item2.get( "expanded" ), "expanded must be true");
            
            this.wait(function(){
                _item2.set( "expanded", false );
                
                Y.Assert.areSame( false, _item2.get( "alwaysVisible" ), "Always visible must be false");
                Y.Assert.areSame( false, _item2.get( "expanded" ), "Expanded must be false");

            }, 1000);
        },
        
        
        testExpandedTrue: function(){
            var _items, _item1, _item2;
                
            _items = _that._accordion.get( "items" );
            
            _item1 = _items[1];
            _item2 = _items[2];
            
            _item2.set( "expanded", true );
            Y.Assert.areSame( false, _item2.get( "alwaysVisible" ), "alwaysvisible must be false");
            Y.Assert.areSame( true, _item2.get( "expanded" ), "expanded must be true");
            
            this.wait(function(){
                _item1.set( "expanded", true );
                
                Y.Assert.areSame( false, _item1.get( "alwaysVisible" ), "Always visible must be false");
                Y.Assert.areSame( true, _item1.get( "expanded" ), "Expanded must be true");
                
                Y.Assert.areSame( false, _item2.get( "alwaysVisible" ), "Always visible must be false");
                Y.Assert.areSame( false, _item2.get( "expanded" ), "Expanded must be false");

            }, 2000);
        }
    });
        
        
    var testInsertRemoveItems = new Y.Test.Case({
        
        testRemoveItemByIndex: function(){
            var _items, _item0, _item3;
            
            _items = _that._accordion.get( "items" );
            
            _item0 = _items[ 0 ];
            _item3 = _that._accordion.removeItem( 3 );
            
            _items = _that._accordion.get( "items" );
            
            Y.Assert.areSame( 3, _items.length, "There must  be 3 items" );
            
            
            // insert item3 before _item0 - it will become the first item
            _that._accordion.addItem( _item3, _item0 );

            _items = _that._accordion.get( "items" );

            Y.Assert.areSame( _item3, _items[ 0 ], "The items must be identical" );
        }
    });
    
    
    var testUserInteractions = new Y.Test.Case( {
        
        testClickExpand: function(){
            var _item3, _header;
            
            _item3 = _that._accordion.getItem( 3 );
            _header = Y.Node.getDOMNode(_item3.getStdModNode( Y.WidgetStdMod.HEADER ));
            
            Y.Event.simulate( _header, "click" );
            Y.Assert.areSame( true, _item3.get( "expanded" ), "Item3 must be exapnded now" );
        },
        
        testClickAlwaysVisible: function(){
            var _item2, _item3, _iconAlwaysVisible;
            
            _item2 = _that._accordion.getItem( 2 );
            _item3 = _that._accordion.getItem( 3 );
            
            _iconAlwaysVisible = Y.Node.getDOMNode(_item2.get( "iconAlwaysVisible" ));

            Y.Event.simulate( _iconAlwaysVisible, "click" );
            
            Y.Assert.areSame( true, _item2.get( "expanded" ), "Item3 must be exapnded now" );
            Y.Assert.areSame( true, _item2.get( "alwaysVisible" ), "Item3 must be always visible" );

            Y.Assert.areSame( false, _item3.get( "expanded" ), "Item3 must be collapsed now" );
        }
        
    });
        
        
    var testContentManipulation = new Y.Test.Case( {
        
        testContentHeightChange: function(){
            var _height, _item2, _body;

            _item2 = _that._accordion.getItem( 2 );
            _body = _item2.getStdModNode( Y.WidgetStdMod.BODY );
            
            _item2.set( "contentHeight", {
                 method: "fixed",
                 height: 30
              } );
                
            this.wait( function(){
                _height = _body.getStyle( "height" );
                Y.Assert.areEqual( "30px", _height, "The body height must be 30px" );
            }, 1000 );
        }
        
    });
    
    
    var testAddItemsFromScript = new Y.Test.Case( {
        
        testAddItemDynamically: function(){
            var _item1, _newItem;
            
            _item1 = _that._accordion.getItem( 1 );
            
            _newItem = new Y.AccordionItem( {
                label: "Item, added from script",
                expanded: true,
                contentBox: "dynamicContentBox",
                contentHeight: {
                    method: "fixed",
                    height: 30
                }
            } );

            _newItem.set( "bodyContent", "This is the body of the item, added dynamically to accordion, after the first item." );
            
            _that._accordion.addItem( _newItem, _item1 );
            
            Y.Assert.areEqual( 1, _that._accordion.getItemIndex( _newItem ), "The index must be 1" );
            Y.Assert.areEqual( true, _newItem.get( "expanded" ), "The item must be expanded" );
            Y.Assert.areEqual( false, _newItem.get( "alwaysVisible" ), "The item must be not always visible" );
        }
    });
    
    
    var testCollapse = new Y.Test.Case( {
        
        testCollapseOthers: function(){
            var _items, _item;
            
            _that._accordion.set( "collapseOthersOnExpand", false );
            
            _items = _that._accordion.get( "items" );
            
            Y.Array.some( _items, function( _item, _index, _items ) {
                if( _index === 4 ){
                    return true;
                }
                
                _item.set( "alwaysVisible", false );
                _item.set( "expanded", true );
                
                return false;
            });
            
            _items[ 4 ].set( "expanded", true );
            
            Y.Array.each( _items, function( _item, _index, _items ) {
                Y.Assert.areEqual( true, _item.get( "expanded" ), "The item must be expanded" );
            });
        },
        
        testDoNotCollapseOthers: function(){
            var _items, _item4;

            _items = _that._accordion.get( "items" );
            _item4 = _items[ 4 ];
            
            _that._accordion.set( "useAnimation", false );
            _item4.set( "expanded", false );
            
            _that._accordion.set( "useAnimation", true );
            _item4.set( "expanded", true );
            
            Y.Array.each( _items, function( _item, _index, _items ) {
                Y.Assert.areEqual( true, _item.get( "expanded" ), "The item must be expanded" );
            });
            
            _that._accordion.set( "collapseOthersOnExpand", true );

        }
    });


    var testClosable = new Y.Test.Case( {
           testCloseItem: function(){
               var _items, _item4, _iconClose;

               _items = _that._accordion.get( "items" );
               _item4 = _items[ 4 ];

               _item4.set( "closable", true );
               _iconClose = _item4.get( "iconClose" );

               Y.Event.simulate(  Y.Node.getDOMNode(_iconClose), "click" );

               _items = _that._accordion.get( "items" );
               Y.Assert.areEqual( 4, _items.length, "There must be 4 items" );
           }
    });


    var testKeyboard = new Y.Test.Case( {
           testCollapseKeyboard: function(){
               var _items, _item1, _iconExtended;

               _items = _that._accordion.get( "items" );
               _item1 = _items[ 1 ];

               _iconExtended = _item1.get( "iconExtended" );

               Y.Event.simulate(  Y.Node.getDOMNode(_iconExtended), "keypress", {
                   charCode: 13
               } );
               Y.Assert.areEqual( false, _item1.get("expanded"), "The item must be not expanded" );
           },

           testExpandKeyboard: function(){
               var _items, _item1, _iconAlwaysVisible;

               _items = _that._accordion.get( "items" );
               _item1 = _items[ 1 ];

               _iconAlwaysVisible = _item1.get( "iconAlwaysVisible" );

               Y.Event.simulate( Y.Node.getDOMNode(_iconAlwaysVisible), "keypress", {
                   charCode: 13
               } );
               Y.Assert.areEqual( true, _item1.get("expanded"), "The item must be expanded" );
               Y.Assert.areEqual( true, _item1.get("alwaysVisible"), "The item must be always visible" );
           }
    });

    //////////////////////////////////////////////////////////////////////////////////////
    
    var _console = new Y.Console({
        verbose : false,
        printTimeout: 0,
        newestOnTop : false,

        entryTemplate: '<pre class="{entry_class} {cat_class} {src_class}">'+
                '<span class="{entry_cat_class}">{label}</span>'+
                '<span class="{entry_content_class}">{message}</span>'+
        '</pre>'
    }).render();

    
    Y.Test.Runner.add(testBuildFromMarkup);
    Y.Test.Runner.add(testInsertRemoveItems);
    Y.Test.Runner.add(testUserInteractions);
    Y.Test.Runner.add(testContentManipulation);
    Y.Test.Runner.add(testAddItemsFromScript);
    Y.Test.Runner.add(testCollapse);
    Y.Test.Runner.add(testClosable);
    Y.Test.Runner.add(testKeyboard);
    

    this._accordion.after( "render", function(){
        Y.Test.Runner.run();
    }, this );
    
    // now render the accordion
    this._accordion.render();
});

//////////////////////////////////////////////////////////////////////////////////////////
